/**
 * embed_kb_whitepapers.js — AxiomAnare KB White Paper Embedder
 * =============================================================
 * Chunks and embeds three vendor white papers into knowledge_chunks via
 * the Voyage AI /embed route on the Cloudflare Worker.
 *
 * Sources (all vendor-published, intended for distribution — copyright clean):
 *   1. spectrum.txt      → SKF, Spectrum Analysis / fault signatures / ISO 2372
 *   2. hfva.txt          → Emerson AMS 2140, stress waves / PeakVue / sensor mounting
 *   3. pruftechnik.txt   → Pruftechnik, fundamentals / transducers / FFT / ISO 2372 / case histories
 *
 * Prerequisites:
 *   node embed_kb_whitepapers.js
 *   (Run from AxiomAnare repo folder in Git Bash after extracting PDFs to .txt)
 *
 * ISO guardrail (DECISIONS A1): these chunks enrich AI report NARRATIVE only.
 * ISO clause references remain CONFIG constants — never sourced from these docs.
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const WORKER_BASE   = 'https://restless-tree-eac8.kairosventure-io.workers.dev';
const SUPABASE_URL  = 'https://zjfhxutcvjxootoekade.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const CHUNK_SIZE    = 400;   // words per chunk
const CHUNK_OVERLAP = 50;    // word overlap between chunks

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var not set.');
  console.error('  export SUPABASE_SERVICE_KEY="your_service_role_key"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Source definitions — mapped to actual knowledge_chunks columns
// ---------------------------------------------------------------------------

const SOURCES = [
  {
    file:            'spectrum.txt',
    source_file:     'Spectrum Analysis.pdf',
    source_label:    'Spectrum Analysis — Fault Signatures and Vibration Patterns',
    source_category: 'instrument',
    category:        'instrument',
    source_path:     'KB/Instrument/SKF',
    fault_tags:      ['spectrum', 'FFT', 'fault_signatures', 'ISO_2372', 'bearing_faults', 'SKF'],
  },
  {
    file:            'hfva.txt',
    source_file:     'high-frequency-vibration-analysis.pdf',
    source_label:    'High-Frequency Vibration Analysis — AMS 2140 PeakVue Technology',
    source_category: 'instrument',
    category:        'instrument',
    source_path:     'KB/Instrument/Emerson',
    fault_tags:      ['stress_waves', 'PeakVue', 'high_frequency', 'sensor_mounting', 'bearing_faults', 'Emerson'],
  },
  {
    file:            'pruftechnik.txt',
    source_file:     'PRUFTECHNIK_Vibration_Handbook.pdf',
    source_label:    'Vibration Handbook — Fundamentals, Transducers, FFT and Case Histories',
    source_category: 'instrument',
    category:        'instrument',
    source_path:     'KB/Instrument/Pruftechnik',
    fault_tags:      ['fundamentals', 'transducers', 'FFT', 'ISO_2372', 'case_histories', 'alignment', 'Pruftechnik'],
  },
];

// ---------------------------------------------------------------------------
// Text chunking (word-window with overlap)
// ---------------------------------------------------------------------------

function chunkText(text, chunkSize, overlap) {
  const words  = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let start    = 0;

  while (start < words.length) {
    const end     = Math.min(start + chunkSize, words.length);
    const content = words.slice(start, end).join(' ').trim();
    if (content.length > 40) chunks.push(content);
    if (end >= words.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Embed via CF Worker — one text at a time, returns { embedding: number[1024] }
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedOne(text) {
  const res = await fetch(`${WORKER_BASE}/embed`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin':       'https://esimconnect.github.io',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embed failed ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (!data.embedding) throw new Error('No embedding in response');
  return data.embedding;
}

async function embedTexts(texts) {
  const embeddings = [];
  for (const text of texts) {
    embeddings.push(await embedOne(text));
    await sleep(100);
  }
  return embeddings;
}

// ---------------------------------------------------------------------------
// Insert rows into Supabase knowledge_chunks
// ---------------------------------------------------------------------------

async function insertChunks(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Insert failed ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let grandTotal = 0;

  for (const src of SOURCES) {
    const filePath = path.join(__dirname, src.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`SKIP — file not found: ${filePath}`);
      continue;
    }

    const rawText = fs.readFileSync(filePath, 'utf8');
    const chunks  = chunkText(rawText, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`\n[${src.source_path}] ${src.source_label}`);
    console.log(`  ${chunks.length} chunks from ${src.file}`);

    const BATCH = 20;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch    = chunks.slice(i, i + BATCH);
      const batchIdx = Math.floor(i / BATCH) + 1;
      const total    = Math.ceil(chunks.length / BATCH);
      process.stdout.write(`  Embedding batch ${batchIdx}/${total}...`);

      let embeddings;
      try {
        embeddings = await embedTexts(batch);
      } catch (err) {
        console.error(`\n  ERROR embedding batch ${batchIdx}: ${err.message}`);
        console.log('  Retrying in 5s...');
        await sleep(5000);
        try {
          embeddings = await embedTexts(batch);
        } catch (err2) {
          console.error(`  FATAL retry failed: ${err2.message} — skipping batch`);
          continue;
        }
      }

      const rows = batch.map((content, j) => ({
        content,
        chunk_text:      content,
        chunk_index:     i + j,
        chunk_tokens:    Math.round(content.split(/\s+/).length * 1.3),
        embedding:       embeddings[j],
        source_file:     src.source_file,
        source_label:    src.source_label,
        source_category: src.source_category,
        source_path:     src.source_path,
        category:        src.category,
        fault_tags:      src.fault_tags,
        iso_zones:       [],
        asset_types:     [],
      }));

      try {
        await insertChunks(rows);
        inserted += rows.length;
        console.log(` inserted ${rows.length}`);
      } catch (err) {
        console.error(`\n  INSERT ERROR batch ${batchIdx}: ${err.message}`);
      }

      await sleep(300);
    }

    console.log(`  → ${inserted}/${chunks.length} chunks embedded for ${src.source_path}`);
    grandTotal += inserted;
  }

  console.log(`\n✓ Done. Total new chunks inserted: ${grandTotal}`);
  console.log('  Verify: SELECT source_category, source_path, COUNT(*) FROM knowledge_chunks GROUP BY 1,2 ORDER BY 2;');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
