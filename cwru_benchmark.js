// CWRU Benchmark Harness (A12-era) — DEPLOY_CHECKLIST §7, automated
//
// WHAT THIS DOES: drives the REAL app.js + index.html in a REAL headless Chrome browser
// (not a re-implementation, not a stub of PapaParse/Chart.js/Supabase). Uploads each CWRU
// fixture through the actual file input, clicks the actual Analyse button, waits for the
// actual pipeline to finish, then reads the actual rendered DOM values.
//
// WHY IT MUST RUN ON A MACHINE WITH REAL NETWORK ACCESS: the app loads PapaParse/Chart.js/
// XLSX from cdnjs.cloudflare.com and fetches bearing constants from Supabase. If those are
// blocked (as they are in some sandboxed CI environments), the pipeline will throw or run
// with missing data — this harness deliberately does NOT stub around that, because a stub
// risks silently faking the exact library behavior the real diagnosis depends on. If a run
// fails, FIX THE NETWORK ACCESS, don't paper over it with fake data.
//
// USAGE:
//   npm install puppeteer
//   node cwru_benchmark.js
//
// Requires index.html, app.js, agnosticParser2.js, agnosticParser.css, multiChannel.js,
// auth.js (whatever index.html actually references) to be present alongside this script,
// i.e. run from the real repo checkout — not a partial file set.

const path = require('path');
const puppeteer = require('puppeteer');

const FIXTURES = [
  { name: '97_Normal',  file: 'cwru_fixtures/CWRU_normal_1797rpm.csv',        expectZone: 'A',  expectFaultContains: null,          note: 'Baseline healthy signal — no fault expected' },
  { name: '105_IR',     file: 'cwru_fixtures/CWRU_IR_fault_007_1797rpm.csv',  expectZone: null, expectFaultContains: 'Inner Race',  note: 'Inner race fault, 0.007in' },
  { name: '118_Ball',   file: 'cwru_fixtures/CWRU_Ball_fault_007_1797rpm.csv',expectZone: 'A',  expectFaultContains: null,          note: 'KNOWN GAP — ball fault historically under-detected (weak/Indicative), do not treat a weak score here as a NEW regression unless it previously scored higher' },
  { name: '130_OR007',  file: 'cwru_fixtures/CWRU_OR_fault_007_1797rpm.csv',  expectZone: null, expectFaultContains: 'Outer Race',  note: 'Outer race fault, 0.007in — override expected to fire' },
  { name: '234_OR021',  file: 'cwru_fixtures/CWRU_OR_fault_021_1797rpm.csv',  expectZone: null, expectFaultContains: 'Outer Race',  note: 'Outer race fault, 0.021in — override expected to fire' },
];

const RPM = 1797; // nameplate speed for all CWRU 1797rpm fixtures — set explicitly, not auto only

async function runOne(page, fixture) {
  // Reload for a clean slate each time (app has in-memory history state).
  await page.reload({ waitUntil: 'networkidle0' });

  // Step 1: select machine class — REQUIRED before analysis; zone thresholds are looked
  // up by class_id and are otherwise undefined. Class II (15-300kW, rigid mount) matches
  // the CWRU motor rig, per past session convention for this benchmark.
  await page.waitForSelector('.class-btn[data-id="cls_ii"]', { timeout: 10000 });
  await page.click('.class-btn[data-id="cls_ii"]');

  // Step 2: the param panel is a collapsed accordion by default — #p-rpm exists in the DOM
  // but is not visible/clickable until #param-toggle expands it. Open it explicitly rather
  // than assuming the field is interactable.
  const formOpen = await page.evaluate(() => document.getElementById('param-form')?.classList.contains('open'));
  if (!formOpen) {
    await page.click('#param-toggle');
    await page.waitForFunction(
      () => document.getElementById('param-form')?.classList.contains('open'),
      { timeout: 5000 }
    );
  }

  // Enter RPM (Step 2) so bearing-fault multipliers can be computed against exact shaft speed.
  const rpmSel = '#p-rpm';
  await page.waitForSelector(rpmSel, { visible: true, timeout: 10000 });
  await page.click(rpmSel, { clickCount: 3 });
  await page.type(rpmSel, String(RPM));
  await page.evaluate(() => { if (typeof onParamChange === 'function') onParamChange(); });

  // Upload the fixture file through the REAL file input.
  const input = await page.$('#fileInput');
  await input.uploadFile(path.resolve(fixture.file));
  // Give the app's onFileSelect / updateStep3Meta / mcOnFileReady chain a moment to settle.
  await page.waitForFunction(
    () => document.getElementById('run-btn') && !document.getElementById('run-btn').disabled,
    { timeout: 15000 }
  ).catch(() => { /* button may not use disabled state — continue and let click fail loudly if wrong */ });

  await page.click('#run-btn');

  // Wait for the real pipeline to finish: top-fault-badge moves off its placeholder.
  await page.waitForFunction(
    () => {
      const el = document.getElementById('top-fault-badge');
      return el && el.textContent && el.textContent.trim() !== '—' && el.textContent.trim() !== '';
    },
    { timeout: 30000 }
  );

  // Extract objective values — no interpretation here, just what's actually on screen.
  const result = await page.evaluate(() => {
    const g = id => document.getElementById(id)?.textContent?.trim() || null;
    return {
      kpiZone: g('kpi-zone'),
      kpiZoneSub: g('kpi-zone-sub'),
      isoClause: g('zone-iso-clause'),
      topFaultBadge: g('top-fault-badge'),
      overrideReason: g('override-reason'),
      sampleRateBannerVisible: !!(document.getElementById('sample-rate-banner') &&
        document.getElementById('sample-rate-banner').style.display !== 'none' &&
        document.getElementById('sample-rate-banner').textContent.trim() !== ''),
      sampleRateBannerText: g('sample-rate-banner'),
      consoleErrorsPresent: window.__cwruConsoleErrors ? window.__cwruConsoleErrors.length : 0,
    };
  });

  return result;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Track real console errors per-page-load so a silently broken run doesn't read as a pass.
  await page.evaluateOnNewDocument(() => { window.__cwruConsoleErrors = []; });
  page.on('pageerror', err => console.error('  [PAGE ERROR]', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('  [console.error]', msg.text()); });

  await page.goto('file://' + path.resolve('index.html'), { waitUntil: 'networkidle0' });

  const results = [];
  for (const fixture of FIXTURES) {
    console.log('Running', fixture.name, '...');
    try {
      const r = await runOne(page, fixture);
      results.push({ ...fixture, result: r });
      console.log('  ->', JSON.stringify(r));
    } catch (e) {
      results.push({ ...fixture, result: null, error: e.message });
      console.log('  -> FAILED:', e.message);
    }
  }

  await browser.close();

  console.log('\n=== CWRU BENCHMARK SUMMARY ===');
  for (const r of results) {
    if (!r.result) { console.log(r.name, ': FAILED TO RUN —', r.error); continue; }
    const zoneOk = r.expectZone ? (r.result.kpiZone === r.expectZone) : true;
    const faultOk = r.expectFaultContains ? (r.result.topFaultBadge || '').includes(r.expectFaultContains) : true;
    console.log(`${r.name}: zone=${r.result.kpiZone} fault="${r.result.topFaultBadge}" srBanner=${r.result.sampleRateBannerVisible} — ${zoneOk && faultOk ? 'MATCHES expectation' : 'CHECK — does not match stated expectation, compare against last known baseline manually'} (${r.note})`);
  }
  console.log('\nCompare this table against the last recorded baseline (STATUS.md / DECISIONS.md) before deciding pass/fail — this script reports facts, not a verdict.');
})();
