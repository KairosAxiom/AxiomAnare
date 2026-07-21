/**
 * AxiomAnare — Agnostic Vibration Ingestion Engine v2.1
 * ======================================================
 * Integrates with app.js without modifying it.
 * All state lives in window.AG namespace.
 *
 * How it hooks into app.js:
 *   - Listens to the same file input / drop events app.js does
 *   - Runs the 5-layer parse pipeline in parallel with stageFile()
 *   - Writes resolved Fs, RPM, asset ID into wizard fields
 *     (p-sample-rate, p-rpm, p-asset-name, p-meas-date)
 *     so readMachineParams() picks them up automatically
 *   - Stores pre-converted mm/s signals in AG.parseResult.channels
 *   - AG.buildSyntheticCSV() produces a velocity CSV that replaces
 *     pendingRaw for g-unit files when user confirms Fs
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// GLOBAL NAMESPACE
// ─────────────────────────────────────────────────────────────────

window.AG = {
  parseResult: null,
  confidence:  0,
  fs:          null,
  rpm:         null,
  vendorKey:   null,

  // Assumption channel (contract consumed by app.js runPipeline).
  // Each entry: { field, assumed, source, corrigible, hint }
  //   field     — short machine key ('unit' | 'sample_rate' | 'unit_conversion')
  //   assumed   — the value the parser fell back to (human-readable)
  //   source    — WHY it was assumed (e.g. 'inferred from signal amplitude range')
  //   corrigible— true if the user can override it in Step 2 and re-run
  //   hint      — plain-language correction instruction shown to the user
  // Empty array = "parser surfaced no assumptions", NEVER interpreted as "safe":
  // app.js still owns its own sample-rate provenance (A12) and merges the two.
  assumptions: [],

  getSignal(colIndex) {
    const ch = this.parseResult?.channels?.find(c => c.index === colIndex);
    return ch?.converted?.length ? ch.converted : null;
  },

  reset() {
    this.parseResult = null;
    this.confidence  = 0;
    this.fs          = null;
    this.rpm         = null;
    this.vendorKey   = null;
    this.assumptions = [];
  },

  // Build a synthetic velocity CSV from the primary converted channel.
  // Injected as pendingRaw so app.js runPipeline receives mm/s data
  // when the original file was in g (or another non-native unit).
  buildSyntheticCSV() {
    const r  = this.parseResult;
    if (!r?.channels?.length) return null;
    const ch = r.channels[0];
    if (!ch.converted?.length) return null;
    const fs  = r.fs || 1000;
    const dt  = 1 / fs;
    const lines = ['time_s,velocity_mm_s'];
    ch.converted.forEach((v, i) => lines.push(
      (i * dt).toFixed(6) + ',' + v.toFixed(6)
    ));
    return lines.join('\n');
  }
};

// ─────────────────────────────────────────────────────────────────
// VENDOR PROFILES
// ─────────────────────────────────────────────────────────────────

const VENDOR_PROFILES = {

  // ── Route / Portable Collectors ───────────────────────────────
  skf_microlog: {
    label: 'SKF Microlog (Analyzer / GX Series)',
    category: 'Route / Portable',
    unit: 'mmps', fsOptions: [3200,6400,12800,25600], fsDefault: 6400,
    notes: 'Exports mm/s velocity. Fs set in route config. Multi-point routes produce multi-column files — each column is a measurement point.',
    quirks: []
  },
  emerson_csi: {
    label: 'Emerson CSI / AMS 2140',
    category: 'Route / Portable',
    unit: 'g', fsOptions: [6400,12800,25600,51200], fsDefault: 12800,
    notes: 'Exports g acceleration. Fs from route config (12.8 kHz typical). Excel exports may have merged header rows — handled automatically.',
    quirks: ['acceleration_g']
  },
  fluke_810: {
    label: 'Fluke 810',
    category: 'Route / Portable',
    unit: 'inps', fsOptions: [25600], fsDefault: 25600,
    notes: 'Always exports in/s velocity. Fixed 25.6 kHz Fs. Single channel per file. Parser converts to mm/s (× 25.4) automatically.',
    quirks: ['single_channel']
  },
  fluke_3550: {
    label: 'Fluke 3550 FC',
    category: 'Route / Portable',
    unit: 'mmps', fsOptions: [], fsDefault: null,
    notes: 'Exports overall RMS scalars — NOT raw waveform. FFT and fault frequency analysis will not be available for this file type.',
    quirks: ['scalar_only']
  },
  pruftechnik: {
    label: 'Prüftechnik Vibscanner',
    category: 'Route / Portable',
    unit: 'mmps', fsOptions: [3200,6400,12800], fsDefault: 6400,
    notes: 'Exports mm/s. Headers include asset name, route, and measurement date. Multi-axis files use H/V/A axis labels.',
    quirks: []
  },
  adash: {
    label: 'Adash A4400 / A4900',
    category: 'Route / Portable',
    unit: 'mmps', fsOptions: [6400,12800,25600], fsDefault: 12800,
    notes: 'Exports mm/s. DDS or CSV format. CSV headers contain measurement point information.',
    quirks: []
  },
  commtest: {
    label: 'Commtest vb Series',
    category: 'Route / Portable',
    unit: 'mmps', fsOptions: [3200,6400,12800], fsDefault: 6400,
    notes: 'Exports mm/s. Proprietary VBD format must be exported to CSV first. Headers contain site / machine / point hierarchy.',
    quirks: []
  },
  erbessd: {
    label: 'Erbessd DigivibeMX',
    category: 'Route / Portable',
    unit: 'g', fsOptions: [3200,6400,12800,25600], fsDefault: 6400,
    notes: 'Triaxial accelerometer in g. CSV columns: X, Y, Z. Sampling rate in file header.',
    quirks: ['acceleration_g','triaxial_xyz']
  },
  crystal: {
    label: 'Crystal Instruments CoCo-80/90',
    category: 'Route / Portable',
    unit: 'g', fsOptions: [12800,25600,51200,102400], fsDefault: 25600,
    notes: 'High-speed DAQ. Two header rows: row 1 = channel names, row 2 = units. Fs in file header.',
    quirks: ['acceleration_g','units_in_row2']
  },
  getac: {
    label: 'Getac / GE Measurement',
    category: 'Route / Portable',
    unit: 'g', fsOptions: [6400,12800,25600], fsDefault: 12800,
    notes: 'Exports g acceleration. Fs typically found in header row or embedded in filename.',
    quirks: ['acceleration_g']
  },

  // ── Online / Continuous Monitoring ────────────────────────────
  skf_imx: {
    label: 'SKF Multilog IMx / WMx',
    category: 'Online / Continuous',
    unit: 'mmps', fsOptions: [12800,25600,51200], fsDefault: 25600,
    notes: 'Continuous monitoring system. CSV exports include a timestamp column plus multiple channel columns.',
    quirks: ['timestamp_column']
  },
  emerson_mhm: {
    label: 'Emerson MHM / AMS 6500 ATG',
    category: 'Online / Continuous',
    unit: 'g', fsOptions: [12800,25600,51200], fsDefault: 25600,
    notes: 'Online system. Exports g waveforms. Excel exports from AMS Machinery Manager may have multi-row metadata blocks.',
    quirks: ['acceleration_g']
  },
  abb_ability: {
    label: 'ABB Ability / Dodge Optify',
    category: 'Online / Continuous',
    unit: 'mmps', fsOptions: [6400,12800], fsDefault: 6400,
    notes: 'May export pre-computed ISO zone results AND raw waveform. Scalar-only files cannot be re-analysed with FFT.',
    quirks: ['may_be_scalar_only']
  },
  ni_daq: {
    label: 'National Instruments DAQ / LabVIEW',
    category: 'Online / Continuous',
    unit: 'g', fsOptions: [1000,2000,5000,10000,25600,51200], fsDefault: 10000,
    notes: 'Row 1 = channel names, row 2 = units, row 3+ = data. Fs usually in a header comment line — enter manually if not found.',
    quirks: ['acceleration_g','units_in_row2']
  },
  hbk_pulse: {
    label: 'Brüel & Kjær PULSE / HBK',
    category: 'Online / Continuous',
    unit: 'g', fsOptions: [16384,32768,65536], fsDefault: 16384,
    notes: '⚠ CHECK: If first column increases uniformly from 0 → Fmax Hz, this is an FFT spectrum (frequency domain) — not a time waveform. Spectral files cannot be re-analysed here.',
    quirks: ['acceleration_g','may_be_fft_spectrum']
  },
  spm_intellinova: {
    label: 'SPM Intellinova',
    category: 'Online / Continuous',
    unit: 'mmps', fsOptions: [6400,12800,25600], fsDefault: 12800,
    notes: 'Exports mm/s velocity waveform. SPM HD shock pulse data is a separate measurement type.',
    quirks: []
  },
  istec: {
    label: 'ISTec / Schenck',
    category: 'Online / Continuous',
    unit: 'mmps', fsOptions: [6400,12800], fsDefault: 6400,
    notes: 'Exports mm/s. Standard CSV with a metadata header block.',
    quirks: []
  },
  ifm: {
    label: 'ifm VSE / VES / VSP',
    category: 'Online / Continuous',
    unit: 'mmps', fsOptions: [6400,12800], fsDefault: 6400,
    notes: 'VSP model exports raw velocity waveform in mm/s. VSE/VES typically export overall RMS scalars only.',
    quirks: ['may_be_scalar_only']
  },
  imc: {
    label: 'IMC CRONOS / SPARTAN',
    category: 'Online / Continuous',
    unit: 'g', fsOptions: [10000,25600,51200,102400], fsDefault: 25600,
    notes: 'High-speed DAQ. imc FAMOS binary format must be exported to CSV before uploading here.',
    quirks: ['acceleration_g']
  },

  // ── IoT / Wireless Sensors ─────────────────────────────────────
  epson: {
    label: 'Epson M-A352AD / M-A352',
    category: 'IoT / Wireless',
    unit: 'g', fsOptions: [1000,2000,3000,4000,8000], fsDefault: 3000,
    notes: 'Triaxial MEMS accelerometer in g. 3-column CSV: X, Y, Z. No metadata header. Default Fs = 3 kHz.',
    quirks: ['acceleration_g','triaxial_xyz','no_header']
  },
  emerson_ams_wireless: {
    label: 'Emerson AMS Wireless Vibration Monitor',
    category: 'IoT / Wireless',
    unit: 'g', fsOptions: [3200,6400], fsDefault: 6400,
    notes: 'WirelessHART sensor. Exports overall levels and 3-axis waveform (X/Y/Z) in g.',
    quirks: ['acceleration_g','triaxial_xyz']
  },
  skf_enlight: {
    label: 'SKF Enlight / QuickCollect',
    category: 'IoT / Wireless',
    unit: 'g', fsOptions: [6400,12800], fsDefault: 6400,
    notes: 'Bluetooth sensor. Exports g acceleration CSV with a timestamp column.',
    quirks: ['acceleration_g','timestamp_column']
  },
  petasense: {
    label: 'Petasense Mote / Atlas',
    category: 'IoT / Wireless',
    unit: 'g', fsOptions: [3200,6400,12800], fsDefault: 6400,
    notes: 'Cloud IIoT sensor. CSV export from Petasense platform includes timestamp, X, Y, Z columns in g.',
    quirks: ['acceleration_g','triaxial_xyz','timestamp_column']
  },
  samsara: {
    label: 'Samsara VT400',
    category: 'IoT / Wireless',
    unit: 'g', fsOptions: [3200], fsDefault: 3200,
    notes: 'Triaxial sensor in g. Fixed 3.2 kHz Fs. Exports as JSON or CSV from the Samsara cloud dashboard.',
    quirks: ['acceleration_g','triaxial_xyz']
  },

  // ── Generic / Research ─────────────────────────────────────────
  matlab_csv: {
    label: 'MATLAB export (writematrix / csvwrite)',
    category: 'Generic / Research',
    unit: null, fsOptions: [], fsDefault: null,
    notes: 'No standard header. Fs MUST be entered manually in the Sampling Rate field. Units depend on your sensor configuration.',
    quirks: ['unit_unknown']
  },
  labview: {
    label: 'LabVIEW / NI Write to Spreadsheet',
    category: 'Generic / Research',
    unit: null, fsOptions: [], fsDefault: null,
    notes: 'Tab-delimited by default. Usually a single header row. Fs must be entered manually.',
    quirks: ['unit_unknown']
  },
  python_csv: {
    label: 'Python / pandas (DataFrame.to_csv)',
    category: 'Generic / Research',
    unit: null, fsOptions: [], fsDefault: null,
    notes: 'Row index often exported as an extra first column — auto-detected and skipped. Fs and units come from your acquisition script.',
    quirks: ['unit_unknown']
  },
  generic_accel_g: {
    label: 'Generic accelerometer output (g units)',
    category: 'Generic / Research',
    unit: 'g', fsOptions: [], fsDefault: null,
    notes: 'Parser will integrate g → mm/s using trapezoidal integration + 2 Hz high-pass filter. Accurate Fs is essential — enter it below.',
    quirks: ['acceleration_g']
  },
  generic_vel_mmps: {
    label: 'Generic velocimeter (mm/s)',
    category: 'Generic / Research',
    unit: 'mmps', fsOptions: [], fsDefault: null,
    notes: 'Already in ISO 10816 native units. No conversion needed. Fs still required for FFT fault classification.',
    quirks: []
  },
  other: {
    label: 'Other / not listed',
    category: 'Generic / Research',
    unit: null, fsOptions: [], fsDefault: null,
    notes: 'Parser uses full heuristic detection. If results look wrong, override unit and Fs manually using the fields above.',
    quirks: []
  }
};

// ─────────────────────────────────────────────────────────────────
// DETECTION PATTERNS
// ─────────────────────────────────────────────────────────────────

// Bugfix (same class as the FS_PAT/TIME_PAT fix below): the original used \b
// boundaries, but \b treats underscore as a word character — so the most common
// real-world unit-in-name conventions "velocity_mm_s", "accel_g", "vibration_mmps"
// NEVER matched, silently falling through to the amplitude-range unit GUESS
// (inferUnitRange). That mislabels units on the majority of underscore-named files
// and, when it guesses wrong, corrupts every ISO velocity zone. Fixed with the same
// letter-only lookaround used for FS_PAT/TIME_PAT so underscores/digits delimit,
// while "g" still correctly rejects gap/gear/avg/range and "accel_DE_X" still maps
// to g. Verified against a match + non-false-positive suite before applying.
const U_PAT = {
  mmps: /(?<![a-zA-Z])(mm\s*\/\s*s|mm\/sec|mmps|velocity|vel)(?![a-zA-Z])/i,
  inps: /(?<![a-zA-Z])(in\s*\/\s*s|in\/sec|ips)(?![a-zA-Z])/i,
  cmps: /(?<![a-zA-Z])(cm\s*\/\s*s|cm\/sec|cmps)(?![a-zA-Z])/i,
  g:    /(?<![a-zA-Z])(g|gs|grav|accel(?:eration)?)(?![a-zA-Z])(?!\s*\/\s*s)/i,
  mps2: /(?<![a-zA-Z])(m\s*\/\s*s[²2]|ms-2|mps2)(?![a-zA-Z])/i,
  mum:  /(?<![a-zA-Z])(µm|um|micron|displacement)(?![a-zA-Z])/i,
  db:   /(?<![a-zA-Z])(db|decibel)(?![a-zA-Z])/i,
};

// Bugfix (applies to all *_PAT constants below): \b requires a non-word character on
// either side, and underscore IS a word character in regex — so "fs_hz", "rpm_value",
// "timestamp_s", "asset_id", "rms_value" etc. (extremely common real-world column
// naming) never matched any of these, silently falling through to be misclassified.
// Fixed with letter-only lookaround boundaries so underscores/digits count as valid
// delimiters on either side. Verified against real column names before applying —
// no new false positives on vibration/threshold column names (accel_DE_X, temp_DE_C,
// prox_NDE_gap_mm, etc.).
const FS_PAT   = /(?<![a-zA-Z])(fs|f_?s|sampling.?rate|sample.?freq|sps|samplerate)(?![a-zA-Z])/i;
const RPM_PAT  = /(?<![a-zA-Z])(rpm|speed|shaft.?speed|rot(?:ation)?.?speed)(?![a-zA-Z])/i;
const UNIT_PAT = /(?<![a-zA-Z])(unit[s]?|measure(?:ment)?|quantity)(?![a-zA-Z])/i;
const DATE_PAT = /(?<![a-zA-Z])(date|timestamp|measured.?on|recorded)(?![a-zA-Z])/i;
const ASSET_PAT= /(?<![a-zA-Z])(asset|machine|equipment|tag|point.?id|location|route)(?![a-zA-Z])/i;
// Bugfix: the original used \b(...)\b, but \b requires a non-word character on either
// side, and underscore IS a word character in regex — so "timestamp_s", "time_ms",
// "sample_idx" etc. (extremely common real-world column naming) never matched, silently
// falling through to be misclassified as a signal/vibration column instead of 'time'.
// Fixed with letter-only lookaround boundaries so underscores and digits count as valid
// delimiters on either side, while "accel_DE_X" style names still correctly don't match.
const TIME_PAT = /(?<![a-zA-Z])(time|t|timestamp|sec(?:ond)?s?|ms|elapsed|index|sample)(?![a-zA-Z])/i;
const SCALAR_PAT=/(?<![a-zA-Z])(rms|peak|overall|average|mean|kurtosis|crest|amplitude|severity)(?![a-zA-Z])/i;
const CMNT     = ['#', '//', ';', '!', '%'];

// ─────────────────────────────────────────────────────────────────
// MAIN PARSE ENTRY POINT
// ─────────────────────────────────────────────────────────────────

async function agnosticParse(file, vendorKey) {
  const ext = file.name.split('.').pop().toLowerCase();
  let result;

  if (['csv','tsv','txt','dat','asc','prn','out'].includes(ext)) {
    const text = await readText(file);
    result = parseText(text, ext, file.name);
  } else if (['xlsx','xls'].includes(ext)) {
    if (typeof XLSX === 'undefined') return null; // let app.js handle Excel natively
    const buf = await readBuffer(file);
    const wb  = XLSX.read(buf, { type: 'array' });
    let best = '', bestN = 0;
    for (const sn of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
      const n   = (csv.match(/[-\d.]+/g)||[]).length;
      if (n > bestN) { best = csv; bestN = n; }
    }
    result = parseText(best, 'csv', file.name);
  } else if (ext === 'json') {
    const text = await readText(file);
    result = parseJSON(text, file.name);
  } else if (ext === 'mat') {
    return null; // app.js has its own MAT parser — don't compete
  } else {
    try { result = parseText(await readText(file), 'csv', file.name); }
    catch { return null; }
  }

  if (vendorKey && VENDOR_PROFILES[vendorKey]) {
    result = applyProfile(result, vendorKey);
  }

  result.parseConfidence = scoreConf(result);
  result.warnings        = buildWarnings(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────
// TEXT PARSER
// ─────────────────────────────────────────────────────────────────

function parseText(text, ext, filename) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  const { headerLines, dataLines, metaKV } = splitBlocks(lines);
  const delim    = detectDelim(dataLines.slice(0,15).join('\n'), ext);
  const { colNames, dataStart } = getColNames(headerLines, dataLines, delim);
  const rows     = parseRows(dataLines.slice(dataStart), delim, colNames.length);

  if (rows.length < 5) throw new Error(`Only ${rows.length} data rows found — need at least 5.`);

  const cols = classifyCols(colNames, rows, metaKV);
  const meta = extractMeta(metaKV, cols, rows, filename);
  return buildResult(cols, rows, meta, filename);
}

// ─── Block splitter ───────────────────────────────────────────────

function splitBlocks(lines) {
  const headerLines=[], dataLines=[], metaKV={};
  let inData = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isComment = CMNT.some(p => line.startsWith(p));
    if (isComment) { parseKV(line.replace(/^[#\/;!%]+\s*/,''), metaKV); headerLines.push(line); continue; }
    const kv = line.match(/^([^,;\t:=\d][^,;\t:=]{0,50})[:\s=]+([^\n]{1,100})$/);
    if (kv && !/\d/.test(kv[1].trim().slice(0,3))) { parseKV(line, metaKV); headerLines.push(line); continue; }
    if (hasNums(line)) inData = true;
    (inData ? dataLines : headerLines).push(line);
  }
  return { headerLines, dataLines, metaKV };
}

function parseKV(line, kv) { const m=line.match(/^([^:=]+)[:\s=]+(.+)$/); if(m) kv[m[1].trim().toLowerCase()]=m[2].trim(); }
function hasNums(line) { return line.split(/[,\t;|]+/).some(p=>!isNaN(parseFloat(p.trim()))&&p.trim()!==''); }

// ─── Delimiter ────────────────────────────────────────────────────

function detectDelim(sample, ext) {
  if (ext==='tsv') return '\t';
  const cands=[',','\t',';','|'];
  let best=',', bestN=0;
  for (const d of cands) { const n=(sample.match(d==='|'?/\|/g:new RegExp('\\'+d,'g'))||[]).length; if(n>bestN){best=d;bestN=n;} }
  return best;
}

// ─── Column names ─────────────────────────────────────────────────

function getColNames(headerLines, dataLines, delim) {
  if (!dataLines.length) throw new Error('No data rows found.');
  const dataWidth = splitRow(dataLines[0], delim).length;
  const fp = splitRow(dataLines[0], delim);
  if (fp.every(p=>isNaN(parseFloat(p.trim()))||p.trim()==='') && dataLines.length>1) {
    return { colNames: fp.map((p,i)=>p.trim().replace(/["']/g,'')||`col_${i+1}`), dataStart:1 };
  }
  for (let i=headerLines.length-1; i>=0; i--) {
    const parts = splitRow(headerLines[i], delim);
    if (parts.length>=dataWidth && parts.every(p=>isNaN(parseFloat(p.trim()))||p.trim()==='')) {
      const names = parts.map((p,j)=>p.trim().replace(/["']/g,'')||`col_${j+1}`);
      while (names.length<dataWidth) names.push(`col_${names.length+1}`);
      return { colNames: names.slice(0,dataWidth), dataStart:0 };
    }
  }
  return { colNames: Array.from({length:dataWidth},(_,i)=>`col_${i+1}`), dataStart:0 };
}

// ─── Row parsing ──────────────────────────────────────────────────

function parseRows(lines, delim, width) {
  const rows=[];
  for (const raw of lines) {
    const line=raw.trim();
    if (!line||CMNT.some(p=>line.startsWith(p))) continue;
    const row = splitRow(line,delim).slice(0,width).map(p=>{ const v=parseFloat(p.trim()); return isNaN(v)?null:v; });
    if (row.some(v=>v!==null)) rows.push(row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────
// COLUMN CLASSIFICATION
// ─────────────────────────────────────────────────────────────────

function classifyCols(colNames, rows, metaKV) {
  return colNames.map((name, idx) => {
    const vals = rows.map(r=>r[idx]).filter(v=>v!==null&&isFinite(v));
    if (vals.length<3) return {index:idx,name,type:'unknown',unit:null,values:[]};
    const stats    = colStats(vals);
    const unitHint = inferUnitName(name);
    const type     = classifyType(name, stats, idx);
    return {index:idx,name,type,unit:unitHint,unitHint,values:vals,stats};
  });
}

function classifyType(name, stats, idx) {
  if (/^(unnamed.*0|index|\s*)$/i.test(name)&&idx===0) return 'index';
  if (TIME_PAT.test(name)) return 'time';
  if (stats.isMonotonic&&stats.range>0&&stats.std/(Math.abs(stats.mean)||1)<0.5) return 'time';
  if (SCALAR_PAT.test(name)) return 'scalar';
  if (stats.uniqueCount<8&&stats.uniqueCount<stats.n*0.03) return 'meta';
  if (stats.n>20) return 'signal';
  return 'unknown';
}

function inferUnitName(name) { for(const [u,p] of Object.entries(U_PAT)){if(p.test(name))return u;} return null; }

// ─────────────────────────────────────────────────────────────────
// METADATA EXTRACTION
// ─────────────────────────────────────────────────────────────────

function extractMeta(metaKV, cols, rows, filename) {
  const m = {fs:null,fsSource:null,rpm:null,date:null,assetId:null,vendor:null,vendorKey:null};

  for (const [k,v] of Object.entries(metaKV)) {
    if (FS_PAT.test(k)) { const hz=parseFloat(v.replace(/[^\d.]/g,'')); if(hz>10&&hz<2e6){m.fs=hz;m.fsSource='file_header';break;} }
  }
  if (!m.fs) {
    const tCol=cols.find(c=>c.type==='time');
    if (tCol&&tCol.values.length>20) {
      const d=tCol.values.slice(1,51).map((v,i)=>v-tCol.values[i]).filter(d=>d>0);
      if (d.length>5) { const med=d.sort((a,b)=>a-b)[Math.floor(d.length/2)];
        for (const mult of [1,1000,0.001]) { const hz=mult/med; if(hz>10&&hz<2e6){m.fs=Math.round(hz);m.fsSource='time_col_delta';break;} } }
    }
  }
  for (const [k,v] of Object.entries(metaKV)) { if(RPM_PAT.test(k)){const r=parseFloat(v.replace(/[^\d.]/g,''));if(r>30&&r<200000){m.rpm=r;break;}} }
  let blanket=null; for (const [k,v] of Object.entries(metaKV)) { if(UNIT_PAT.test(k)){blanket=inferUnitStr(v);break;} }
  for (const [k,v] of Object.entries(metaKV)) { if(DATE_PAT.test(k)){m.date=v;break;} }
  for (const [k,v] of Object.entries(metaKV)) { if(ASSET_PAT.test(k)){m.assetId=v;break;} }

  const kvStr=Object.entries(metaKV).map(([k,v])=>`${k}=${v}`).join(' ');
  const colStr=cols.map(c=>c.name).join(' ');
  m.vendor=fingerprint(kvStr+' '+colStr+' '+filename);
  m.vendorKey=vendorToKey(m.vendor);

  for (const col of cols.filter(c=>c.type==='signal')) {
    // unitSource records HOW the unit was resolved, so downstream assumption
    // reporting can distinguish a confident match from a fallback guess:
    //   'name'   — matched from the column name (U_PAT) in classifyCols  [confident]
    //   'blanket'— matched from a file-level "units=" metadata line        [confident]
    //   'range'  — GUESSED from signal amplitude range                     [ASSUMED]
    //   'default'— no unit at all; buildResult will treat as mm/s          [ASSUMED]
    if (col.unit) { col.unitSource = col.unitSource || 'name'; }
    else if (blanket) { col.unit = blanket; col.unitSource = 'blanket'; }
    else { col.unit = inferUnitRange(col.stats); col.unitSource = 'range'; }
  }
  return m;
}

function inferUnitStr(str) { for(const [u,p] of Object.entries(U_PAT)){if(p.test(str))return u;} return null; }
function inferUnitRange(stats) {
  if (!stats) return 'mmps';
  const absMax=Math.max(Math.abs(stats.min),Math.abs(stats.max));
  if (absMax<100&&stats.std<20&&Math.abs(stats.mean)<5) return 'g';
  if (absMax<=200) return 'mmps';
  return 'mum';
}

function fingerprint(str) {
  const s=str.toLowerCase();
  if (/skf|@ptitude|microlog|aptitude|quickcollect|enlight/.test(s)) return 'SKF';
  if (/emerson|ams\b|mhm|csi\b/.test(s)) return 'Emerson AMS';
  if (/bruel|kjaer|bksv|pulse|hbk/.test(s)) return 'Brüel & Kjær / HBK';
  if (/fluke|vibcheck/.test(s)) return 'Fluke';
  if (/abb|ability|dodge|optify/.test(s)) return 'ABB';
  if (/national instruments|ni_|labview/.test(s)) return 'National Instruments';
  if (/epson|seiko/.test(s)) return 'Epson';
  if (/prüftechnik|pruftechnik|vibscanner/.test(s)) return 'Prüftechnik';
  if (/adash/.test(s)) return 'Adash';
  if (/commtest/.test(s)) return 'Commtest';
  if (/spm|intellinova/.test(s)) return 'SPM';
  if (/petasense/.test(s)) return 'Petasense';
  if (/samsara/.test(s)) return 'Samsara';
  if (/\bifm\b/.test(s)) return 'ifm';
  if (/imc|cronos|spartan/.test(s)) return 'IMC';
  if (/crystal.*instrument|coco/.test(s)) return 'Crystal Instruments';
  return null;
}

function vendorToKey(name) {
  return {'SKF':'skf_microlog','Emerson AMS':'emerson_csi','Brüel & Kjær / HBK':'hbk_pulse',
    'Fluke':'fluke_810','ABB':'abb_ability','National Instruments':'ni_daq','Epson':'epson',
    'Prüftechnik':'pruftechnik','Adash':'adash','Commtest':'commtest','SPM':'spm_intellinova',
    'Petasense':'petasense','Samsara':'samsara','ifm':'ifm','IMC':'imc',
    'Crystal Instruments':'crystal'}[name]||null;
}

// ─────────────────────────────────────────────────────────────────
// BUILD RESULT
// ─────────────────────────────────────────────────────────────────

function buildResult(cols, rows, meta, filename) {
  let sigCols=cols.filter(c=>c.type==='signal');
  if (!sigCols.length) {
    sigCols=cols.filter(c=>c.values.length>5&&c.type!=='time'&&c.type!=='index'&&c.type!=='meta');
    sigCols.forEach(c=>c.type='signal');
  }
  const channels=sigCols.map((col,i)=>{
    const rawUnit=col.unit||'unknown';
    const conv=toMmps(col.values,rawUnit,meta.fs);
    return {index:col.index,name:col.name,rawUnit,unitLabel:uLabel(rawUnit),
      unitSource:col.unitSource||(col.unit?'name':'default'),
      _rawValues:col.values,converted:conv.signal,conversionMethod:conv.method,
      conversionApprox:conv.approx,wasConverted:conv.method!=='identity',
      suggestedLocation:suggestLoc(col.name,i),suggestedAxis:suggestAxis(col.name,i),
      location:null,axis:null};
  });
  return {filename,vendor:meta.vendor,vendorKey:meta.vendorKey,vendorLabel:meta.vendor||'Unknown format',
    vendorProfileApplied:false,vendorNotes:null,channels,channelCount:channels.length,
    fs:meta.fs,fsSource:meta.fsSource,fsMissing:!meta.fs,rpm:meta.rpm,date:meta.date,
    assetId:meta.assetId,sampleCount:rows.length,
    durationSeconds:meta.fs?+(rows.length/meta.fs).toFixed(2):null,
    parseConfidence:0,warnings:[],_cols:cols,_meta:meta};
}

// ─────────────────────────────────────────────────────────────────
// UNIT CONVERSION
// ─────────────────────────────────────────────────────────────────

function toMmps(signal, unit, fs) {
  if (!signal?.length) return {signal:[],method:'empty',approx:false};
  switch(unit) {
    case 'mmps': return {signal,method:'identity',approx:false};
    case 'inps': return {signal:signal.map(v=>v*25.4),method:'scale_inps×25.4',approx:false};
    case 'cmps': return {signal:signal.map(v=>v*10),method:'scale_cmps×10',approx:false};
    case 'g':    return fs ? integrateG(signal,fs) : {signal:signal.map(v=>v*9810/(2*Math.PI*50)),method:'scale_g_approx_no_fs',approx:true};
    case 'mps2': return fs ? integrateG(signal.map(v=>v/9.81),fs) : {signal:signal.map(v=>v*1000/(2*Math.PI*50)),method:'scale_mps2_approx_no_fs',approx:true};
    case 'mum':  return {signal:signal.map(v=>v*0.001),method:'scale_µm_passthrough',approx:true};
    case 'db':   return {signal:signal.map(v=>Math.pow(10,v/20)*1e-6),method:'antilog_db',approx:false};
    default:     return {signal,method:'passthrough_unknown',approx:true};
  }
}

function integrateG(gSig, fs) {
  const dt=1/fs, mmps2=gSig.map(v=>v*9810);
  const vel=new Float64Array(mmps2.length);
  for (let i=1;i<mmps2.length;i++) vel[i]=vel[i-1]+0.5*(mmps2[i]+mmps2[i-1])*dt;
  // 1st-order Butterworth HPF @ 2 Hz — removes integration DC drift
  const rc=1/(2*Math.PI*2), alpha=rc/(rc+dt);
  const hp=new Float64Array(vel.length);
  for (let i=1;i<vel.length;i++) hp[i]=alpha*(hp[i-1]+vel[i]-vel[i-1]);
  return {signal:Array.from(hp),method:'integrate_g→mm/s+HP2Hz',approx:false};
}

function uLabel(u) { return {mmps:'mm/s',inps:'in/s',cmps:'cm/s',g:'g',mps2:'m/s²',mum:'µm',db:'dB',unknown:'?'}[u]||(u||'?'); }

// ─────────────────────────────────────────────────────────────────
// VENDOR PROFILE APPLICATION
// ─────────────────────────────────────────────────────────────────

function applyProfile(result, key) {
  const p=VENDOR_PROFILES[key]; if(!p) return result;
  result.vendorKey=key; result.vendorLabel=p.label;
  result.vendorProfileApplied=true; result.vendorNotes=p.notes;
  if (!result.fs&&p.fsDefault) { result.fs=p.fsDefault; result.fsSource='vendor_profile_default'; }
  if (p.unit) result.channels.forEach(ch=>{ if(!ch.rawUnit||ch.rawUnit==='unknown'){ch.rawUnit=p.unit;ch.unitLabel=uLabel(p.unit);} });
  if (p.quirks.includes('may_be_fft_spectrum')) (result.warnings=result.warnings||[]).push({code:'FFT_SPECTRUM_RISK',severity:'critical',message:'Brüel & Kjær files may contain FFT spectra (not time waveforms). If first column increases 0→Fmax Hz uniformly, this is a spectrum and cannot be re-analysed here.'});
  if (p.quirks.includes('scalar_only')) (result.warnings=result.warnings||[]).push({code:'SCALAR_ONLY',severity:'warning',message:`${p.label} typically exports overall RMS scalars, not raw waveforms. FFT and fault frequency analysis may not be meaningful.`});
  result.channels=result.channels.map(ch=>{ const conv=toMmps(ch._rawValues||ch.converted,ch.rawUnit,result.fs); return{...ch,converted:conv.signal,conversionMethod:conv.method,conversionApprox:conv.approx,wasConverted:conv.method!=='identity'}; });
  return result;
}

// ─────────────────────────────────────────────────────────────────
// CONFIDENCE & WARNINGS
// ─────────────────────────────────────────────────────────────────

function scoreConf(r) {
  let s=100;
  if (!r.fs) s-=25;
  if (r.channelCount===0) s-=40;
  if (r.channels.some(c=>!c.rawUnit||c.rawUnit==='unknown')) s-=15;
  if (r.channels.some(c=>c.conversionApprox)) s-=10;
  if (!r.vendor) s-=5;
  return Math.max(0,s);
}

function buildWarnings(r) {
  const w=[...(r.warnings||[])];
  if (!r.fs) w.push({code:'FS_MISSING',severity:'critical',message:'Sampling rate not found. Select your data collector below, or enter it in the Sampling Rate field in Step 2.'});
  if (r.channelCount===0) w.push({code:'NO_SIGNALS',severity:'critical',message:'No signal columns detected. File may contain only computed scalars, not a raw waveform.'});
  r.channels?.forEach(ch=>{
    if (!ch.rawUnit||ch.rawUnit==='unknown') w.push({code:'UNIT_UNKNOWN',severity:'warning',message:`Column "${ch.name}": unit unknown — treated as mm/s. Verify before running analysis.`});
    if (ch.conversionApprox) w.push({code:'CONV_APPROX',severity:'info',message:`Column "${ch.name}": conversion approximated (${ch.conversionMethod}). Enter Fs for accurate integration.`});
  });
  return w;
}

// ─────────────────────────────────────────────────────────────────
// ASSUMPTION CHANNEL  (contract consumed by app.js runPipeline)
// Emits ONLY assumptions the parser is responsible for (unit, unit-conversion
// approximation, and vendor-default sample rate). app.js owns its own
// sample-rate provenance (A12) and merges these in — see AG.assumptions doc.
// ─────────────────────────────────────────────────────────────────

function buildAssumptions(r) {
  const a = [];
  if (!r) return a;

  // (1) Unit assumed — a signal channel whose unit was GUESSED from amplitude
  // range, or defaulted with no unit at all. A wrong unit guess silently
  // corrupts every ISO velocity-zone and FFT-amplitude result, so this is the
  // highest-value assumption to surface. Name-matched / blanket-matched /
  // vendor-profile units are confident and NOT reported here.
  const guessed = (r.channels||[]).filter(
    ch => ch.unitSource === 'range' || ch.unitSource === 'default'
  );
  if (guessed.length) {
    const names = guessed.map(ch => ch.name).join(', ');
    const shown = guessed[0].unitLabel || 'mm/s';
    a.push({
      field: 'unit',
      assumed: shown,
      source: guessed.length === (r.channels||[]).length
        ? 'inferred from signal amplitude range (no unit label in file)'
        : `inferred from signal amplitude range for: ${names}`,
      corrigible: true,
      hint: 'If the sensor output is acceleration (g / m/s²) or in/s, set the correct unit in Step 2 and re-run — the ISO velocity zone depends on it.'
    });
  }

  // (2) Unit-conversion approximated — conversion ran but is an approximation
  // (e.g. g→mm/s without a real Fs, or an unknown-unit passthrough). Distinct
  // from (1): the unit may be known but the CONVERSION is unverified.
  const approx = (r.channels||[]).filter(
    ch => ch.conversionApprox && ch.unitSource !== 'range' && ch.unitSource !== 'default'
  );
  if (approx.length) {
    a.push({
      field: 'unit_conversion',
      assumed: approx[0].conversionMethod || 'approximate',
      source: `conversion approximated for: ${approx.map(c=>c.name).join(', ')}`,
      corrigible: true,
      hint: 'Enter an accurate sampling rate in Step 2 so acceleration→velocity integration is exact rather than approximated, then re-run.'
    });
  }

  // (3) Sample rate came from a VENDOR-PROFILE default (not the file, not the
  // user). app.js labels file/timestamp/hand-keyed values itself; this covers
  // the one origin only the parser knows about — an unverified vendor default.
  if (r.fs && r.fsSource === 'vendor_profile_default') {
    a.push({
      field: 'sample_rate',
      assumed: r.fs.toLocaleString() + ' Hz',
      source: 'vendor-profile default (not found in the file, not entered)',
      corrigible: true,
      hint: 'Confirm the real acquisition rate from your collector/analyzer export settings and enter it in Step 2 — all fault frequencies scale with it.'
    });
  }

  return a;
}

// ─────────────────────────────────────────────────────────────────
// SUGGESTIONS
// ─────────────────────────────────────────────────────────────────

function suggestLoc(name, i) {
  const n=name.toLowerCase();
  if (/drive.?end|de\b|d\.e/.test(n)) return 'Drive End';
  if (/fan.?end|fe\b|nde\b|non.?drive/.test(n)) return 'Fan End';
  if (/gear.?in|input/.test(n)) return 'Gearbox Input';
  if (/gear.?out|output/.test(n)) return 'Gearbox Output';
  const bm=n.match(/bearing[_\s]?(\d)/); if(bm) return `Bearing ${bm[1]}`;
  return ['Drive End','Drive End','Drive End','Fan End','Fan End','Fan End'][i]||'Drive End';
}

function suggestAxis(name, i) {
  const n=name.toLowerCase();
  if (/\bx\b|horiz|\bh\b/.test(n)) return 'X';
  if (/\by\b|vert|\bv\b/.test(n)) return 'Y';
  if (/\bz\b|axial|\ba\b/.test(n)) return 'Z';
  return ['X','Y','Z'][i%3];
}

// ─────────────────────────────────────────────────────────────────
// JSON PARSER
// ─────────────────────────────────────────────────────────────────

function parseJSON(text, filename) {
  let data; try{data=JSON.parse(text);}catch{throw new Error('Not valid JSON.');}
  if (Array.isArray(data)&&typeof data[0]==='object') {
    const keys=Object.keys(data[0]), rows=data.map(obj=>keys.map(k=>parseFloat(obj[k])||0));
    const cols=classifyCols(keys,rows,{}); return buildResult(cols,rows,extractMeta({},cols,rows,filename),filename);
  }
  if (typeof data==='object'&&!Array.isArray(data)) {
    const metaKV={},sigKeys=[];
    for (const [k,v] of Object.entries(data)) { if(Array.isArray(v)&&v.length>5&&typeof v[0]==='number')sigKeys.push(k); else if(typeof v!=='object')metaKV[k.toLowerCase()]=String(v); }
    if (!sigKeys.length) throw new Error('No signal arrays in JSON.');
    const maxLen=Math.max(...sigKeys.map(k=>data[k].length));
    const rows=Array.from({length:maxLen},(_,i)=>sigKeys.map(k=>data[k][i]||0));
    const cols=classifyCols(sigKeys,rows,metaKV); return buildResult(cols,rows,extractMeta(metaKV,cols,rows,filename),filename);
  }
  throw new Error('Unrecognised JSON structure.');
}

// ─────────────────────────────────────────────────────────────────
// STATS & UTILITIES
// ─────────────────────────────────────────────────────────────────

function colStats(vals) {
  const n=vals.length, mean=vals.reduce((s,v)=>s+v,0)/n;
  const variance=vals.reduce((s,v)=>s+(v-mean)**2,0)/n, std=Math.sqrt(variance);
  const sorted=[...vals].sort((a,b)=>a-b);
  let isMono=true; for(let i=1;i<Math.min(n,100);i++){if(vals[i]<vals[i-1]){isMono=false;break;}}
  return {n,mean,std,min:sorted[0],max:sorted[n-1],range:sorted[n-1]-sorted[0],isMonotonic:isMono,
    uniqueCount:new Set(vals.slice(0,200).map(v=>v.toFixed(4))).size};
}

function splitRow(line, delim) {
  if (delim!==',') return line.split(delim);
  const out=[]; let cur='',inQ=false;
  for(const ch of line){if(ch==='"')inQ=!inQ; else if(ch===','&&!inQ){out.push(cur);cur='';}else cur+=ch;}
  out.push(cur); return out;
}

function readText(file) {
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=()=>rej(new Error('Cannot read file.'));r.readAsText(file);});
}
function readBuffer(file) {
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=()=>rej(new Error('Cannot read file.'));r.readAsArrayBuffer(file);});
}

// ─────────────────────────────────────────────────────────────────
// PARSE CONFIDENCE CARD
// ─────────────────────────────────────────────────────────────────

function renderParseCard(result) {
  const el=document.getElementById('parseConfidenceCard');
  if (!el||!result) return;
  el.innerHTML=buildCardHTML(result);
  el.style.display='block';
}

function buildCardHTML(r) {
  const confColour=r.parseConfidence>=80?'#51cf66':r.parseConfidence>=55?'#ffd43b':'#ff4444';
  const showHint=r.parseConfidence<75||!r.vendor;

  const warnHTML=(r.warnings||[]).map(w=>`
    <div class="pcc-warn pcc-warn--${w.severity}">
      <span>${w.severity==='critical'?'⚠':w.severity==='warning'?'!':'i'}</span>
      <span>${w.message}</span>
    </div>`).join('');

  const chRows=r.channels.map(ch=>`
    <div class="pcc-ch-row">
      <span class="pcc-ch-name">${ch.name}</span>
      <span class="pcc-ch-unit">${ch.unitLabel}→mm/s</span>
      <span class="pcc-ch-method">${ch.conversionMethod}${ch.conversionApprox?' ⚠':''}</span>
      <span class="pcc-ch-map">${ch.suggestedLocation}/${ch.suggestedAxis}</span>
    </div>`).join('');

  return `
<div class="pcc">
  <div class="pcc-top">
    <div class="pcc-vendor-block">
      <span class="pcc-vendor-name">${r.vendorLabel}</span>
      ${r.vendorProfileApplied?'<span class="pcc-badge pcc-badge--profile">profile applied</span>':r.vendor?'<span class="pcc-badge pcc-badge--auto">auto-detected</span>':'<span class="pcc-badge pcc-badge--unknown">unrecognised</span>'}
    </div>
    <span class="pcc-conf" style="color:${confColour}">${r.parseConfidence}% confidence</span>
  </div>
  <div class="pcc-grid">
    <div class="pcc-cell"><div class="pcc-cell-label">Channels</div><div class="pcc-cell-val">${r.channelCount}</div></div>
    <div class="pcc-cell">
      <div class="pcc-cell-label">Sampling rate</div>
      <div class="pcc-cell-val ${r.fsMissing?'pcc-missing':'pcc-ok'}">
        ${r.fsMissing?'Not found':r.fs.toLocaleString()+' Hz'}
        ${r.fsSource?`<span class="pcc-src">${{'file_header':'from file','time_col_delta':'from Δt','vendor_profile_default':'vendor default'}[r.fsSource]||r.fsSource}</span>`:''}
      </div>
    </div>
    <div class="pcc-cell"><div class="pcc-cell-label">RPM in file</div><div class="pcc-cell-val">${r.rpm?r.rpm.toLocaleString():'—'}</div></div>
    <div class="pcc-cell"><div class="pcc-cell-label">Samples</div><div class="pcc-cell-val">${r.sampleCount.toLocaleString()}</div></div>
    <div class="pcc-cell"><div class="pcc-cell-label">Asset ID</div><div class="pcc-cell-val">${r.assetId||'—'}</div></div>
    <div class="pcc-cell"><div class="pcc-cell-label">Date in file</div><div class="pcc-cell-val">${r.date||'—'}</div></div>
  </div>
  ${r.channelCount>0?`
  <div class="pcc-section-label">Signal channels detected</div>
  <div class="pcc-ch-table">
    <div class="pcc-ch-head"><span>Column</span><span>Unit</span><span>Conversion</span><span>Suggested mapping</span></div>
    ${chRows}
  </div>`:''}
  ${r.vendorNotes?`<div class="pcc-vendor-notes">${r.vendorNotes}</div>`:''}
  ${warnHTML}
  ${showHint?buildHintHTML(r.vendor,r.vendorLabel):''}
</div>`;
}

function buildHintHTML(autoVendor, autoLabel) {
  const groups={};
  for (const [key,p] of Object.entries(VENDOR_PROFILES)) {
    if (!groups[p.category]) groups[p.category]=[];
    groups[p.category].push({key,label:p.label});
  }
  const opts=Object.entries(groups).map(([cat,items])=>`
    <optgroup label="${cat}">
      ${items.map(i=>`<option value="${i.key}"${autoLabel&&i.label===autoLabel?' selected':''}>${i.label}</option>`).join('')}
    </optgroup>`).join('');
  return `
<div class="pcc-hint-box">
  <div class="pcc-hint-label">Which data collector exported this file?
    <span class="pcc-hint-optional">Optional — helps resolve unit and sampling rate.</span>
  </div>
  <div class="pcc-hint-row">
    <select id="vendorHintSelect" onchange="onVendorHintChange(this.value)">
      <option value="">— Select collector (optional) —</option>${opts}
    </select>
  </div>
  <div id="vendorHintNotes" class="pcc-hint-notes" style="display:none"></div>
  <div id="vendorHintFsRow" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;">
    <span class="pcc-fs-label">Sampling rate:</span>
    <select id="vendorFsSelect" onchange="onVendorFsSelect(this.value)"></select>
    <input type="number" id="vendorFsCustom" placeholder="or enter Hz manually" min="10" max="2000000"
           oninput="onVendorFsCustom(this.value)"
           style="width:160px;background:var(--surface3,#1a2030);border:1px solid var(--border,#2a3a52);color:var(--text,#e8edf5);border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit;">
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────
// VENDOR HINT CALLBACKS
// ─────────────────────────────────────────────────────────────────

window.onVendorHintChange = function(key) {
  if (!key||!VENDOR_PROFILES[key]) return;
  const p=VENDOR_PROFILES[key];
  const notesEl=document.getElementById('vendorHintNotes');
  if (notesEl){notesEl.textContent=p.notes;notesEl.style.display='block';}
  const fsRow=document.getElementById('vendorHintFsRow');
  const fsSelect=document.getElementById('vendorFsSelect');
  if (fsRow&&fsSelect) {
    fsSelect.innerHTML=p.fsOptions.length
      ?p.fsOptions.map(f=>`<option value="${f}"${f===p.fsDefault?' selected':''}>${f.toLocaleString()} Hz</option>`).join('')
      :'<option value="">Enter manually →</option>';
    fsRow.style.display=(p.fsOptions.length||!AG.fs)?'flex':'none';
  }
  if (AG.parseResult) {
    const updated=applyProfile(JSON.parse(JSON.stringify(AG.parseResult)),key);
    updated.parseConfidence=scoreConf(updated); updated.warnings=buildWarnings(updated);
    AG.parseResult=updated; AG.vendorKey=key;
    AG.assumptions=buildAssumptions(updated);
    renderParseCard(updated); syncWizard(updated);
  }
};

window.onVendorFsSelect=function(val){const hz=parseFloat(val);if(!isNaN(hz)&&hz>0)applyFsOverride(hz);};
window.onVendorFsCustom=function(val){const hz=parseFloat(val);if(!isNaN(hz)&&hz>10)applyFsOverride(hz);};

function applyFsOverride(hz) {
  if (!AG.parseResult) return;
  AG.parseResult.fs=hz; AG.parseResult.fsSource='user_manual'; AG.parseResult.fsMissing=false; AG.fs=hz;
  AG.parseResult.channels=AG.parseResult.channels.map(ch=>{
    if (['g','mps2'].includes(ch.rawUnit)){const conv=toMmps(ch._rawValues,ch.rawUnit,hz);return{...ch,converted:conv.signal,conversionMethod:conv.method,conversionApprox:conv.approx};}
    return ch;
  });
  AG.parseResult.parseConfidence=scoreConf(AG.parseResult); AG.parseResult.warnings=buildWarnings(AG.parseResult);
  AG.assumptions=buildAssumptions(AG.parseResult);
  renderParseCard(AG.parseResult); syncWizard(AG.parseResult);
}

// ─────────────────────────────────────────────────────────────────
// WIZARD FIELD SYNC  (only fills empty fields — never overwrites)
// ─────────────────────────────────────────────────────────────────

function syncWizard(r) {
  if (r.fs) {
    AG.fs=r.fs;
    const el=document.getElementById('p-sample-rate'); if(el&&!el.value) el.value=r.fs;
  }
  if (r.rpm) {
    AG.rpm=r.rpm;
    const el=document.getElementById('p-rpm'); if(el&&!el.value) el.value=r.rpm;
  }
  if (r.assetId) { const el=document.getElementById('p-asset-name'); if(el&&!el.value) el.value=r.assetId; }
  if (r.date)    { const el=document.getElementById('p-meas-date');  if(el&&!el.value) el.value=r.date;    }
}

// ─────────────────────────────────────────────────────────────────
// HOOK: attach to file input + drop events after DOM loads
// Runs in parallel with app.js stageFile() — no conflicts
// ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {

  // File input — same element app.js uses
  const fi=document.getElementById('fileInput');
  if (fi) fi.addEventListener('change', async function(){
    if (this.files[0]) await runAG(this.files[0]);
  });

  // Wrap window.onDrop (app.js defines this as a global)
  const orig=window.onDrop;
  window.onDrop=async function(e){
    e.preventDefault();
    if (e.dataTransfer?.files?.[0]) await runAG(e.dataTransfer.files[0]);
    if (orig) orig.call(this,e);
  };

});

async function runAG(file) {
  AG.reset();
  const prog=document.getElementById('parseProgress');
  if (prog){prog.textContent='Detecting format…';prog.style.display='block';}

  try {
    const result=await agnosticParse(file, null);
    if (!result) { if(prog) prog.style.display='none'; return; }

    AG.parseResult=result; AG.confidence=result.parseConfidence;
    AG.fs=result.fs; AG.rpm=result.rpm; AG.vendorKey=result.vendorKey;
    AG.assumptions=buildAssumptions(result);
    syncWizard(result);
    renderParseCard(result);

    // Multi-channel banner
    const banner=document.getElementById('multiChannelSuggestion');
    if (banner&&result.channelCount>1) {
      banner.innerHTML=`<span>${result.channelCount} signal channels detected.</span>
        <button onclick="typeof setChannelMode==='function'&&setChannelMode('multi');this.closest('#multiChannelSuggestion').style.display='none'">
          Switch to multi-channel →
        </button>`;
      banner.style.display='flex';
    }
  } catch(err) {
    const errEl=document.getElementById('parseError');
    if (errEl){errEl.textContent='Parse note: '+err.message;errEl.style.display='block';}
  }

  if (prog) prog.style.display='none';
}
