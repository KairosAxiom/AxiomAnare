// ============================================================
// AxiomAnare — Multi-Channel Engine  (multiChannel.js)
// Up to 12 channels (dropdown 1-12) | vibration + threshold-alert
// channel types | 2 locations × 3 axes for vibration | ISO 13373-1
// ============================================================

// ── State ────────────────────────────────────────────────────
window.MC = {
  enabled:      false,        // toggled by wizard switch
  mapping:      [],           // [{col, type, location, axis, thresholdLabel, thresholdValue, thresholdDirection}]
  results:      [],           // per-channel NVR results after pipeline
  rawTable:     null,         // parsed rows (all columns) from parseData
  channelCount: null,         // user-selected channel count (1-12); null = not yet set, defaults from detection
};

// ── Constants ─────────────────────────────────────────────────
const MC_LOCATIONS = [
  'Drive End', 'Fan End',
  'Gearbox Input', 'Gearbox Output',
  'Bearing 1', 'Bearing 2', 'Bearing 3',
  'Bearing 4', 'Bearing 5', 'Bearing 6',
  'Bearing 7', 'Bearing 8',
];
const MC_AXES = ['X', 'Y', 'Z'];
// Ceiling for the channel-count dropdown comes from window.CONFIG.mc_max_channels (12)

// ── ISO 13373-1 Cross-Axis Confidence Rules ───────────────────
// Keys are fault categories; each rule boosts confidence when
// the same fault appears on multiple axes.
// Cross-axis rules loaded from CONFIG at runtime (see app.js mc_cross_axis_rules)
// Accessor — always reads live from window.CONFIG so rules stay in sync
function mcGetCrossAxisRules() {
  return window.CONFIG?.mc_cross_axis_rules || [];
}

// ── Detect numeric columns that look like signal channels ─────
// Returns array of column names (excludes time/index/sample)
function mcDetectSignalColumns(parsedResult) {
  if (!parsedResult) return [];
  const allHeaders = parsedResult.allHeaders || [];

  // Columns to always exclude — not raw vibration signals
  const excludePatterns = [
    // Time / index
    'time','timestamp','t','date','seconds','ms','index','sample','i','n',
    // Metadata / descriptive
    'machine','sensor','location','unit','tag','id','name','label','type',
    'equipment','asset','point','channel','description','comment','note',
    // Derived / processed (not raw signals)
    'severity','zone','iso_zone','status','grade','class','category',
    'day','hour','minute','hour_of_day','shift','period',
    'rms','peak','cf','crest','kurtosis','skew','deviation','sigma',
    'health','score','index','indicator','flag','alert','alarm',
    // Environmental / process
    'temperature','temp','humidity','pressure','flow','speed','load',
    'power','current','voltage','frequency','rpm','hz',
    // Phase / trigger
    'phase','spike_phase','trigger','tach','key',
    // Displacement (derived from velocity/accel)
    'displacement','disp',
  ];

  // Patterns that positively indicate a vibration signal column
  const signalPatterns = [
    'accel','acc','acceleration','vibration','vib','velocity','vel',
    'amplitude','amp','signal','ch','chan','axis',
    '_x','_y','_z','_h','_v','_a',
    'g_rms','mm_s','mm/s','in_s',
  ];

  return allHeaders.filter(h => {
    const hl = h.toLowerCase();

    // Hard exclude if matches any exclusion pattern
    if (excludePatterns.some(ex =>
      hl === ex || hl.startsWith(ex + '_') || hl.endsWith('_' + ex) ||
      hl.includes('_' + ex + '_')
    )) return false;

    // Accept if matches a signal pattern
    if (signalPatterns.some(sig => hl.includes(sig))) return true;

    // Otherwise: only accept if it's a short generic column name
    // (e.g. 'ch1', 'x', 'y', 'z') and not a known non-signal type
    if (/^(ch\d+|channel\d+|[xyz]\d*|axis\d*)$/i.test(hl)) return true;

    // Default: reject ambiguous columns — better to miss one than false-positive
    return false;
  });
}

// ── All numeric columns assignable to a channel slot ───────────
// Broader than mcDetectSignalColumns(): that function only returns columns that LOOK
// like vibration signals, which is right for auto-detection but wrong for manual channel
// assignment — a temperature or proximity-probe column should still be pickable in the
// column dropdown, just defaulted to 'threshold' type rather than 'vibration'.
// Only time/index/metadata-style columns are excluded here; everything else numeric-ish
// is a legitimate channel candidate.
function mcGetAssignableColumns(parsedResult) {
  if (!parsedResult) return [];
  const allHeaders = parsedResult.allHeaders || [];
  const excludeAlways = [
    'time','timestamp','t','date','seconds','ms','index','sample','i','n',
    'machine','sensor','location','unit','tag','id','name','label','type',
    'equipment','asset','point','channel','description','comment','note',
  ];
  return allHeaders.filter(h => {
    const hl = h.toLowerCase();
    return !excludeAlways.some(ex => hl === ex || hl.startsWith(ex + '_') || hl.endsWith('_' + ex));
  });
}

// ── Guess a sensible default channel type from its column name ─
// 'threshold' for anything that reads like a non-vibration process/environmental
// measurement (temperature, proximity/displacement gap, pressure, etc.); 'vibration'
// otherwise. This is only ever a DEFAULT — the user can override it per channel.
function mcGuessChannelType(colName) {
  const cl = colName.toLowerCase();
  const thresholdPatterns = [
    'temp','temperature','proximity','prox','gap','displacement','disp',
    'pressure','press','flow','current','voltage','humidity',
  ];
  return thresholdPatterns.some(p => cl.includes(p)) ? 'threshold' : 'vibration';
}

// ── Guess a short human label for a threshold channel ───────────
function mcGuessThresholdLabel(colName) {
  const cl = colName.toLowerCase();
  if (cl.includes('temp')) return 'Temperature';
  if (cl.includes('prox') || cl.includes('gap') || cl.includes('disp')) return 'Proximity Gap';
  if (cl.includes('press')) return 'Pressure';
  if (cl.includes('flow')) return 'Flow';
  if (cl.includes('current')) return 'Current';
  if (cl.includes('voltage')) return 'Voltage';
  if (cl.includes('humid')) return 'Humidity';
  return colName;
}


function mcExtractColumn(raw, colName) {
  const result = typeof Papa !== 'undefined'
    ? Papa.parse(raw.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true })
    : null;
  if (result?.data?.length > 5) {
    const values = result.data.map(r => r[colName]).filter(v => typeof v === 'number' && isFinite(v));
    // Detect unit from column name
    const cl = colName.toLowerCase();
    let unit = 'g';
    if (cl.includes('velocity') || cl.includes('vel_') || cl === 'vel') unit = 'mm/s';
    else if (cl.includes('mm_s') || cl === 'mm/s') unit = 'mm/s';
    else if (cl.includes('m/s2') || cl.includes('ms2')) unit = 'm/s2';
    else if (cl.includes('mg') && !cl.includes('img')) unit = 'mg';
    return { values, unit };
  }
  return { values: [], unit: 'g' };
}

// ── Apply cross-axis confidence rules ─────────────────────────
// Input: array of per-channel NVR result objects (each has .axis, .faults)
// Returns: array of cross-axis findings with boosted confidence
function mcApplyCrossAxisRules(channelResults) {
  const findings = [];
  for (const rule of mcGetCrossAxisRules()) {
    // Group 1: channels sharing the same location
    const byLocation = {};
    for (const ch of channelResults) {
      const loc = ch.location || 'Unknown';
      if (!byLocation[loc]) byLocation[loc] = [];
      byLocation[loc].push(ch);
    }
    // Group 2: all channels together (same machine, different measurement points)
    // This catches imbalance/misalignment which appear across all axes regardless of location
    const allGroup = { '__all__': channelResults };
    const groups = { ...byLocation, ...allGroup };

    for (const [loc, channels] of Object.entries(groups)) {
      if (channels.length < rule.requiredAxes) continue;
      // Find channels where this fault has meaningful confidence
      const faultThreshold = window.CONFIG?.mc_cross_axis_fault_threshold_pct ?? 10;
      const axesWithFault = channels.filter(ch => {
        const top = (ch.faults || []).find(f => {
          if (f.locked || f.pct < faultThreshold) return false;
          if (rule.faultName) return f.name === rule.faultName;
          return f.category === rule.category;
        });
        return !!top;
      });
      if (axesWithFault.length >= rule.requiredAxes) {
        const avgPct = axesWithFault.reduce((s, ch) => {
          const f = (ch.faults || []).find(f =>
            rule.faultName ? f.name === rule.faultName : f.category === rule.category
          );
          return s + (f?.pct || 0);
        }, 0) / axesWithFault.length;
        const displayLoc = loc === '__all__' ? 'All Channels' : loc;
        // Skip if already captured by a more specific location group
        const alreadyFound = findings.some(f =>
          f.rule.id === rule.id && f.axes.join() === axesWithFault.map(ch => ch.axis).join()
        );
        if (!alreadyFound) {
          findings.push({
            rule,
            location: displayLoc,
            axes: axesWithFault.map(ch => ch.axis),
            basePct: avgPct,
            boostedPct: Math.min(98, avgPct + rule.boostPct),
            confirmed: true,
          });
        }
      }
    }
  }
  return findings;
}

// ── Build a summary verdict across all channels ───────────────
function mcBuildCombinedVerdict(channelResults, crossAxisFindings) {
  if (!channelResults.length) return null;

  // Worst zone across all channels
  const zoneOrder = ['A', 'B', 'C', 'D'];
  const worstZone = channelResults.reduce((worst, ch) => {
    const zi = zoneOrder.indexOf(ch.zoneRow?.zone_label);
    const wi = zoneOrder.indexOf(worst);
    return zi > wi ? ch.zoneRow.zone_label : worst;
  }, 'A');

  // Highest fault confidence (boosted by cross-axis where applicable)
  let topFault = null;
  let topPct = 0;
  for (const f of crossAxisFindings) {
    if (f.boostedPct > topPct) {
      topPct = f.boostedPct;
      topFault = { name: f.rule.label, pct: f.boostedPct, crossAxis: true, clause: f.rule.clause, location: f.location, axes: f.axes };
    }
  }
  for (const ch of channelResults) {
    const cf = (ch.faults || []).find(f => !f.locked);
    if (cf && cf.pct > topPct) {
      topPct = cf.pct;
      topFault = { ...cf, location: ch.location, axis: ch.axis, crossAxis: false };
    }
  }

  // ── Fault-adjusted zone override (ISO 13379-1:2012 §5.4) ──────────────
  // Frequency-domain fault findings override RMS-based zone when confidence
  // is high enough — same policy as single-channel applyFaultOverride().
  // This prevents a false "Zone A green" when significant faults are developing.
  let adjustedZone = worstZone;
  let zoneOverrideReason = null;
  const cfg = window.CONFIG;
  const bearingOverridePct  = cfg?.fault_zone_override?.bearing_threshold  ?? 60;
  const elevatedOverridePct = cfg?.fault_zone_override?.elevated_threshold ?? 40;

  if (topPct >= bearingOverridePct && (worstZone === 'A' || worstZone === 'B')) {
    // Strong confirmed fault — escalate to C
    adjustedZone = worstZone === 'A' ? 'C' : 'C';
    zoneOverrideReason = `Fault confidence ${topPct.toFixed(0)}% overrides RMS zone — ISO 13379-1:2012 §5.4`;
  } else if (topPct >= elevatedOverridePct && worstZone === 'A') {
    // Elevated fault in Zone A — escalate to B (caution)
    adjustedZone = 'B';
    zoneOverrideReason = `Fault confidence ${topPct.toFixed(0)}% indicates developing fault in Zone A — monitor closely`;
  }

  // Worst RUL
  const minRUL = Math.min(...channelResults.map(ch => ch.rulR?.days || 999));

  // Overall health index (average, weighted toward worst)
  const hiVals = channelResults.map(ch => {
    const h = ch.healthIdx;
    return typeof h === 'object' ? (h?.score ?? 50) : (h ?? 100);
  }).sort((a, b) => a - b);
  const weightedHI = hiVals.length > 1
    ? (hiVals[0] * 2 + hiVals.slice(1).reduce((s, v) => s + v, 0)) / (hiVals.length + 1)
    : hiVals[0];

  return {
    worstZone: adjustedZone,
    worstZoneRMS: worstZone,
    zoneOverrideReason,
    topFault,
    minRUL,
    healthIdx: Math.round(weightedHI),
    channelCount: channelResults.length,
    crossAxisFindings,
  };
}

// ── Build a default MC.mapping entry for slot i ────────────────
// col may be null (slot added beyond what auto-detection found — user must assign
// a column manually). Type is guessed from the column name when a column is known;
// vibration otherwise, since that's the more common case for slot 0..N from detection.
function mcDefaultMappingEntry(col, i, vibColsSet) {
  const type = col ? (vibColsSet.has(col) ? 'vibration' : mcGuessChannelType(col)) : 'vibration';
  const location = MC_LOCATIONS[i % MC_LOCATIONS.length];
  if (type === 'threshold') {
    return {
      col, type: 'threshold', location,
      thresholdLabel: col ? mcGuessThresholdLabel(col) : 'Threshold',
      thresholdValue: null, thresholdDirection: 'above',
      enabled: true,
    };
  }
  return { col, type: 'vibration', location, axis: MC_AXES[i % 3], enabled: true };
}

// ── Render the channel mapping UI (called on new file load) ───
// vibCols: auto-detected vibration-looking columns (from mcDetectSignalColumns).
// parsedResult: full parseData() result, used to compute the broader assignable-column
// list (vibration cols are unioned in so a header the auto-detector recognises is
// always selectable, even if for some format reason mcGetAssignableColumns missed it).
function mcRenderMappingUI(vibCols, parsedResult) {
  const container = document.getElementById('mc-mapping-container');
  if (!container) return;

  const assignable = mcGetAssignableColumns(parsedResult || {});
  MC._assignableCols = Array.from(new Set([...vibCols, ...assignable]));
  const vibColsSet = new Set(vibCols);
  const ceiling = window.CONFIG?.mc_max_channels || 12;

  // Default channel count: sticky across file loads once the user has set it; on first
  // load, default to however many vibration channels were auto-detected (min 1).
  if (MC.channelCount === null) {
    MC.channelCount = Math.min(Math.max(vibCols.length, 1), ceiling);
  }

  // Ordered candidate list for auto-filling slots: detected vibration columns first
  // (best default channels), then any other assignable column (temp/proximity/etc.)
  const remaining = MC._assignableCols.filter(c => !vibColsSet.has(c));
  const ordered = [...vibCols, ...remaining];

  MC.mapping = [];
  for (let i = 0; i < MC.channelCount; i++) {
    MC.mapping.push(mcDefaultMappingEntry(ordered[i] || null, i, vibColsSet));
  }

  mcRenderMappingContainer();
}

// ── Pure render from current MC.mapping / MC.channelCount ─────
// Called after initial mcRenderMappingUI() and after any count/type/column/field change.
function mcRenderMappingContainer() {
  const container = document.getElementById('mc-mapping-container');
  if (!container) return;
  const ceiling = window.CONFIG?.mc_max_channels || 12;
  const cols = MC._assignableCols || [];

  container.innerHTML = `
    <div class="mc-mapping-header">
      <span class="mc-mapping-title">&#128290; Multi-Channel</span>
      <span class="mc-mapping-sub">
        Channels:
        <select class="mc-select mc-select-count" id="mc-channel-count" onchange="mcSetChannelCount(this.value)">
          ${Array.from({length: ceiling}, (_, n) => n + 1).map(n =>
            `<option value="${n}" ${MC.channelCount === n ? 'selected' : ''}>${n}</option>`
          ).join('')}
        </select>
        — assign a data column, type, and location to each
      </span>
    </div>
    <div class="mc-channel-grid">
      ${MC.mapping.map((ch, i) => mcRenderChannelRow(ch, i, cols)).join('')}
    </div>
  `;
}

// ── Render a single channel row (column + type + type-specific fields) ─
function mcRenderChannelRow(ch, i, cols) {
  return `
    <div class="mc-channel-row" id="mc-ch-${i}">
      <select class="mc-select mc-select-col" id="mc-col-${i}" onchange="mcUpdateMapping(${i})" title="Data column for this channel">
        ${!ch.col ? `<option value="" selected disabled>-- select column --</option>` : ''}
        ${cols.map(c => `<option value="${c}" ${ch.col === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="mc-select mc-select-type" id="mc-type-${i}" onchange="mcUpdateChannelType(${i}, this.value)" title="How this channel should be analysed">
        <option value="vibration" ${ch.type === 'vibration' ? 'selected' : ''}>Vibration</option>
        <option value="threshold" ${ch.type === 'threshold' ? 'selected' : ''}>Threshold (temp / proximity / etc.)</option>
      </select>
      <div class="mc-ch-fields" id="mc-fields-${i}">${mcRenderChannelFields(ch, i)}</div>
    </div>
  `;
}

// ── Type-specific fields: vibration gets Location+Axis, threshold gets ──
// Location + label + threshold value + above/below direction.
function mcRenderChannelFields(ch, i) {
  if (ch.type === 'threshold') {
    return `
      <select class="mc-select" id="mc-loc-${i}" onchange="mcUpdateMapping(${i})">
        ${MC_LOCATIONS.map(l => `<option value="${l}" ${ch.location === l ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <input class="mc-text-input" id="mc-label-${i}" type="text" value="${ch.thresholdLabel || ''}"
        placeholder="e.g. DE Bearing Temp" onchange="mcUpdateMapping(${i})" title="Display label for this channel">
      <input class="mc-num-input" id="mc-thresh-${i}" type="number" value="${ch.thresholdValue ?? ''}"
        placeholder="Limit" onchange="mcUpdateMapping(${i})" title="Alert threshold value">
      <select class="mc-select mc-select-dir" id="mc-dir-${i}" onchange="mcUpdateMapping(${i})" title="Alert when reading goes above or below the limit">
        <option value="above" ${ch.thresholdDirection === 'above' ? 'selected' : ''}>Alert if above</option>
        <option value="below" ${ch.thresholdDirection === 'below' ? 'selected' : ''}>Alert if below</option>
      </select>
    `;
  }
  return `
    <select class="mc-select" id="mc-loc-${i}" onchange="mcUpdateMapping(${i})">
      ${MC_LOCATIONS.map(l => `<option value="${l}" ${ch.location === l ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <select class="mc-select mc-select-axis" id="mc-ax-${i}" onchange="mcUpdateMapping(${i})">
      ${MC_AXES.map(a => `<option value="${a}" ${ch.axis === a ? 'selected' : ''}>${a}</option>`).join('')}
    </select>
  `;
}

// ── Channel-count dropdown handler ─────────────────────────────
// Pads with new default slots (guessed from any still-unused assignable column) or
// truncates from the end. Existing slots keep their current assignment untouched.
window.mcSetChannelCount = function(n) {
  n = parseInt(n);
  const ceiling = window.CONFIG?.mc_max_channels || 12;
  n = Math.max(1, Math.min(ceiling, n));
  MC.channelCount = n;

  const usedCols = new Set(MC.mapping.map(m => m.col).filter(Boolean));
  const vibColsSet = new Set(MC.mapping.filter(m => m.type === 'vibration' && m.col).map(m => m.col));
  const spareCols = (MC._assignableCols || []).filter(c => !usedCols.has(c));

  if (n > MC.mapping.length) {
    for (let i = MC.mapping.length; i < n; i++) {
      const col = spareCols.shift() || null;
      MC.mapping.push(mcDefaultMappingEntry(col, i, vibColsSet));
    }
  } else {
    MC.mapping = MC.mapping.slice(0, n);
  }
  mcRenderMappingContainer();
};

// ── Column/type/field change handlers ──────────────────────────
window.mcUpdateChannelType = function(i, newType) {
  if (!MC.mapping[i]) return;
  const col = MC.mapping[i].col;
  const location = MC.mapping[i].location;
  MC.mapping[i] = newType === 'threshold'
    ? { col, type: 'threshold', location, thresholdLabel: col ? mcGuessThresholdLabel(col) : 'Threshold', thresholdValue: null, thresholdDirection: 'above', enabled: true }
    : { col, type: 'vibration', location, axis: MC_AXES[i % 3], enabled: true };
  mcRenderMappingContainer();
};

window.mcToggleChannel = function(i, enabled) {
  if (MC.mapping[i]) MC.mapping[i].enabled = enabled;
  const row = document.getElementById('mc-ch-' + i);
  if (row) row.classList.toggle('mc-ch-disabled', !enabled);
};

window.mcUpdateMapping = function(i) {
  const m = MC.mapping[i];
  if (!m) return;
  const colEl = document.getElementById('mc-col-' + i);
  if (colEl) m.col = colEl.value;

  if (m.type === 'threshold') {
    const loc = document.getElementById('mc-loc-' + i);
    const lbl = document.getElementById('mc-label-' + i);
    const thr = document.getElementById('mc-thresh-' + i);
    const dir = document.getElementById('mc-dir-' + i);
    if (loc) m.location = loc.value;
    if (lbl) m.thresholdLabel = lbl.value;
    if (thr) m.thresholdValue = thr.value === '' ? null : parseFloat(thr.value);
    if (dir) m.thresholdDirection = dir.value;
  } else {
    const loc = document.getElementById('mc-loc-' + i);
    const ax  = document.getElementById('mc-ax-' + i);
    if (loc) m.location = loc.value;
    if (ax)  m.axis = ax.value;
  }
};

// ── A12 (multi-channel): resolve sample rate ONCE for the whole file ──────
// All channels in a multi-channel file share one time base, so this is resolved once,
// not per-channel. Same priority as the single-channel path in app.js: user hand-keyed
// exact value > auto-detected (header/timestamp) > user-selected Fmax preset > none.
// Returns null (never a silent CONFIG.default_sample_rate_hz fallback) if nothing found —
// caller must quarantine the run and ask the user for a value, exactly like runPipeline().
function mcResolveSampleRate(raw) {
  const mp = window.machineParams || {};
  if (mp.declaredSampleRate && !mp.sampleRateIsPreset) {
    return { sr: mp.declaredSampleRate, srSource: 'declared', sampleRateAssumed: false };
  }

  const result = typeof Papa !== 'undefined'
    ? Papa.parse(raw.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true })
    : null;
  if (result?.data?.length > 5) {
    const headers = result.meta?.fields || Object.keys(result.data[0] || {});
    const { sampleRate, sampleRateSource } = window.detectSampleRateFromRows(headers, result.data);
    if (sampleRate) return { sr: sampleRate, srSource: sampleRateSource, sampleRateAssumed: false };
  }

  if (mp.declaredSampleRate && mp.sampleRateIsPreset) {
    return { sr: mp.declaredSampleRate, srSource: 'preset', sampleRateAssumed: true };
  }
  return null;
}

// ── Run pipeline for each active channel ─────────────────────
// Called from app.js instead of single-channel runPipeline when MC.enabled
async function runMultiChannelPipeline(raw, filename) {
  MC.results = [];
  // Auto-enable all channels if none are explicitly enabled
  if (!MC.mapping.some(m => m.enabled)) {
    MC.mapping.forEach(m => m.enabled = true);
  }
  const activeChannels = MC.mapping.filter(m => m.enabled && m.col);
  if (!activeChannels.length) {
    alert('No channels assigned — pick a data column for at least one channel.');
    return;
  }

  // == A12: no silent default — quarantine the whole run if no sample rate can be
  // resolved, same policy as the single-channel pipeline (was previously the exact
  // bug A12 fixed for single-channel: `declaredSampleRate || CONFIG.default_sample_rate_hz`).
  const srResolved = mcResolveSampleRate(raw);
  if (!srResolved) {
    if (typeof doneStage === 'function') doneStage(1, 'QUARANTINED');
    if (typeof setNote === 'function') setNote('(!) Sample rate required — not found in file and not provided. Enter it in Step 2 (Sampling Rate field or Fmax preset) before running analysis.');
    if (typeof requireSampleRateInput === 'function') requireSampleRateInput();
    return;
  }
  const { sr, srSource, sampleRateAssumed } = srResolved;

  // Show processing screen
  const procScreen = document.getElementById('processing-screen');
  if (procScreen) procScreen.style.display = 'flex';
  document.getElementById('results-screen').style.display = 'none';

  for (let i = 0; i < activeChannels.length; i++) {
    const ch = activeChannels[i];

    // ── Threshold-type channel: simple over/under alert, no FFT/fault classification ──
    if (ch.type === 'threshold') {
      const label = `[${ch.location} · ${ch.thresholdLabel || ch.col}]`;
      if (typeof setNote === 'function') setNote(`Channel ${i+1}/${activeChannels.length} — ${label}`);
      const { values } = mcExtractColumn(raw, ch.col);
      if (values.length < 1) {
        MC.results.push({ col: ch.col, location: ch.location, type: 'threshold', label: ch.thresholdLabel || ch.col, error: 'No data' });
        continue;
      }
      if (ch.thresholdValue === null || ch.thresholdValue === undefined || isNaN(ch.thresholdValue)) {
        MC.results.push({ col: ch.col, location: ch.location, type: 'threshold', label: ch.thresholdLabel || ch.col, error: 'No threshold value set' });
        continue;
      }
      const extreme = ch.thresholdDirection === 'below' ? Math.min(...values) : Math.max(...values);
      const alert_ = ch.thresholdDirection === 'below' ? extreme < ch.thresholdValue : extreme > ch.thresholdValue;
      MC.results.push({
        col: ch.col, location: ch.location, type: 'threshold',
        label: ch.thresholdLabel || ch.col,
        value: extreme, thresholdValue: ch.thresholdValue,
        direction: ch.thresholdDirection, alert: alert_,
      });
      continue;
    }

    // ── Vibration-type channel: full FFT / fault-classification / RUL pipeline ──
    const label = `[${ch.location} · ${ch.axis}]`;
    if (typeof setNote === 'function') setNote(`Channel ${i+1}/${activeChannels.length} — ${label}`);

    // Extract this column's values from raw
    const { values, unit } = mcExtractColumn(raw, ch.col);
    if (values.length < 10) {
      MC.results.push({ col: ch.col, location: ch.location, axis: ch.axis, type: 'vibration', error: 'Insufficient data' });
      continue;
    }

    const cu = window.CONFIG.unit_conversion_factors.find(r => r.canonical_flag === 1).to_unit;
    const currentClassId = (window.__getSelClassId && window.__getSelClassId()) || window.selClassId;

    // Convert units
    let vals;
    if (['g', 'm/s2', 'mg'].includes(unit)) {
      const rf = window.computeFFT(values, sr);
      const hz = window.detectShaft(rf);
      vals = values.map(v => window.toCanonicalUnit(v, unit, hz));
    } else {
      vals = values.map(v => window.toCanonicalUnit(v, unit, null));
    }

    // Core statistics
    const n    = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
    const rms  = Math.sqrt(vals.reduce((s, v) => s + v * v, 0) / n);
    let peak = 0;
    for (let j = 0; j < vals.length; j++) { const a = Math.abs(vals[j]); if (a > peak) peak = a; }
    const cf   = peak / (rms || 1);
    const kurt = vals.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / n;

    // Zone / fault / RUL
    const zoneRow  = window.lookupZone(rms, currentClassId);
    const classRow = window.CONFIG.iso_machine_classes.find(c => c.class_id === currentClassId);
    const fftR = window.computeFFT(vals, sr);
    fftR._rawSignal = vals;
    if (window.machineParams?.shaftHz > 0) fftR._shaftHz = window.machineParams.shaftHz;
    const dataTypes = window.detectDataTypes([ch.col]);
    const allFaults = window.classifyFaults(fftR, cf, kurt, dataTypes, window.machineParams || {});
    const faults = [...allFaults.filter(f => !f.locked), ...allFaults.filter(f => f.locked)];

    // Deviation score (no baseline per-channel — uses signal self-stats)
    const devSc  = (rms - mean) / std;
    const devRow = window.classifyDeviation(Math.abs(devSc));

    // Trend (DDU — single file, multi-channel rarely has history per-channel)
    const trendRow = window.CONFIG.trend_state_rules.find(r => r.code === 'DDU');

    // Override + RUL
    const override = window.applyFaultOverride(zoneRow, window.calcRUL(zoneRow.zone_label, trendRow.code), faults, kurt, cf, classRow);
    const rulR = override.rulR;
    const finalZoneRow = override.zoneRow;

    const topBearingFault = faults.find(f => !f.locked && f.category === 'bearing');
    const healthIdxObj = window.calcHealthIndex(rms, kurt, cf, finalZoneRow.zone_label,
      topBearingFault ? topBearingFault.pct : 0, Math.abs(devSc), classRow);
    const healthIdx = healthIdxObj?.score ?? healthIdxObj ?? 50;

    MC.results.push({
      col: ch.col,
      type: 'vibration',
      location: ch.location,
      axis: ch.axis,
      rms: rms.toFixed(3),
      peak: peak.toFixed(3),
      cf: cf.toFixed(2),
      kurt: kurt.toFixed(2),
      devSc: devSc.toFixed(2),
      devRow,
      zoneRow: finalZoneRow,
      trendRow,
      faults,
      fftR,
      rulR,
      healthIdx,
      sr, srSource, sampleRateAssumed,
      cu,
      n,
      classRow,
    });
  }

  // Cross-axis analysis and combined verdict — vibration channels only; threshold
  // channels never feed fault/zone/health scoring, only their own alert state.
  const vibResults = MC.results.filter(r => !r.error && r.type === 'vibration');
  const thresholdResults = MC.results.filter(r => r.type === 'threshold');
  const crossAxisFindings = mcApplyCrossAxisRules(vibResults);
  const combined = mcBuildCombinedVerdict(vibResults, crossAxisFindings);
  if (combined) combined.sampleRateAssumed = sampleRateAssumed;

  // Render MC combined verdict
  if (procScreen) procScreen.style.display = 'none';
  document.getElementById('results-screen').style.display = 'block';
  mcRenderResults(MC.results, combined, filename);

  // Render worst channel through single-channel pipeline for FFT/radar/trend charts
  // Find worst channel by zone then RMS — vibration channels only (threshold channels
  // have no zone/RMS to compare)
  const zoneOrder = ['A','B','C','D'];
  const worstCh = vibResults.sort((a, b) => {
    const zi = zoneOrder.indexOf(b.zoneRow?.zone_label) - zoneOrder.indexOf(a.zoneRow?.zone_label);
    return zi !== 0 ? zi : parseFloat(b.rms) - parseFloat(a.rms);
  })[0];

  if (worstCh && window.nvr !== undefined) {
    // Inject worst channel data into nvr so renderResults/buildFFT/buildRadar work
    window.nvr = {
      filename: `${filename} — ${worstCh.location} (${worstCh.axis}) [worst channel]`,
      rms: worstCh.rms, peak: worstCh.peak, cf: worstCh.cf, kurt: worstCh.kurt,
      devSc: worstCh.devSc, devRow: worstCh.devRow,
      zoneRow: worstCh.zoneRow, trendRow: worstCh.trendRow,
      faults: worstCh.faults, fftR: worstCh.fftR, rulR: worstCh.rulR,
      healthIdx: (() => {
        const score = worstCh.healthIdx;
        const thr = (window.CONFIG?.health_thresholds || [{min:75,label:'Good',color:'var(--green)'},{min:50,label:'Monitor',color:'#f59e0b'},{min:0,label:'Critical',color:'var(--red)'}]);
        const t = [...thr].sort((a,b)=>b.min-a.min).find(t=>score>=t.min) || thr[thr.length-1];
        return { score, label: t.label, color: t.color, breakdown: [] };
      })(),
      n: worstCh.n, sr: worstCh.sr, cu: worstCh.cu, classRow: worstCh.classRow,
      dataTypes: { vibration: true }, dataBanner: '',
      earlyWarn: false, override: { overrideActive: false },
      singleFile: true, historyCount: 0, _history: [],
      shaftHz: window.machineParams?.shaftHz || 0,
      machineParams: window.machineParams || {},
      assetName: null,
    };
    // Update results meta label
    const metaEl = document.getElementById('results-meta');
    if (metaEl) metaEl.textContent = `Multi-Channel · ${vibResults.length} vibration + ${thresholdResults.length} threshold channel${(vibResults.length+thresholdResults.length)!==1?'s':''} · Worst: ${worstCh.location} (${worstCh.axis})`;
    // Run single-channel render for charts
    if (typeof renderResults === 'function') renderResults();
  } else {
    const metaEl = document.getElementById('results-meta');
    if (metaEl) metaEl.textContent = `Multi-Channel · ${thresholdResults.length} threshold channel${thresholdResults.length!==1?'s':''} (no vibration channels configured)`;
  }

  // Increment free analysis counter + apply gates (watermark, PDF lock, trial banner)
  if (typeof Freemium !== 'undefined') {
    Freemium.increment();
    if (typeof applyFreemiumGates === 'function') applyFreemiumGates();
  }

  // Stream Claude multi-channel AI summary
  mcStreamClaude(MC.results, combined, filename);
}

// ── Channel colour palette ────────────────────────────────────
const MC_CH_COLORS = [
  { line: '#4d9de0', fill: 'rgba(77,157,224,0.15)',  label: 'X' },
  { line: '#e15759', fill: 'rgba(225,87,89,0.15)',   label: 'Y' },
  { line: '#59a14f', fill: 'rgba(89,161,79,0.15)',   label: 'Z' },
  { line: '#f28e2b', fill: 'rgba(242,142,43,0.15)',  label: 'Ch4' },
  { line: '#b07aa1', fill: 'rgba(176,122,161,0.15)', label: 'Ch5' },
  { line: '#76b7b2', fill: 'rgba(118,183,178,0.15)', label: 'Ch6' },
];

// ── MC chart instances ────────────────────────────────────────
let mcRadarInst = null, mcFftInst = null;
// Expose to window so app.js beforeprint handler can redraw them
Object.defineProperty(window, 'mcRadarInst', { get: () => mcRadarInst, configurable: true });
Object.defineProperty(window, 'mcFftInst',   { get: () => mcFftInst,   configurable: true });

// ── Render multi-channel results ─────────────────────────────
function mcRenderResults(channelResults, combined, filename) {
  const container = document.getElementById('multiChannelResults');
  if (!container) return;

  // Hide single-channel charts; MC has its own
  const scr = document.getElementById('single-channel-results');
  if (scr) scr.style.display = 'none';

  const zoneColors = { A: '#22c55e', B: '#f59e0b', C: '#f97316', D: '#ef4444' };
  const zoneBg     = { A: 'rgba(34,197,94,0.1)', B: 'rgba(245,158,11,0.12)', C: 'rgba(249,115,22,0.15)', D: 'rgba(239,68,68,0.15)' };
  const cardBorder = combined?.worstZone === 'D' ? 'rgba(239,68,68,0.5)'
                   : combined?.worstZone === 'C' ? 'rgba(249,115,22,0.4)'
                   : combined?.worstZone === 'B' ? 'rgba(245,158,11,0.35)'
                   : 'rgba(77,157,224,0.35)';
  const hiColor = h => h >= 75 ? '#22c55e' : h >= 50 ? '#f59e0b' : h >= 25 ? '#f97316' : '#ef4444';
  // Vibration channels drive charts/zone/health scoring. Threshold channels are a
  // separate, simpler alert display — they never feed the combined verdict.
  const ok = channelResults.filter(r => !r.error && r.type === 'vibration');
  const thresholds = channelResults.filter(r => r.type === 'threshold' && !r.error);
  const thresholdErrors = channelResults.filter(r => r.type === 'threshold' && r.error);
  const activeAlerts = thresholds.filter(t => t.alert);

  container.innerHTML = `
    <div class="mc-combined-card" style="border-color:${cardBorder}">
      <div class="mc-combined-header">
        <span class="mc-combined-icon">&#128202;</span>
        <div>
          <div class="mc-combined-title">Multi-Channel Combined Assessment</div>
          <div class="mc-combined-sub">${filename} &middot; ${ok.length} vibration + ${thresholds.length} threshold channel${(ok.length+thresholds.length)!==1?'s':''} &middot; ISO 13373-1${combined?.zoneOverrideReason ? `<br><span style="color:${zoneColors[combined?.worstZone]||'#f59e0b'};font-size:9px;">&#9888; Zone escalated from ${combined.worstZoneRMS} (RMS) &mdash; ${combined.zoneOverrideReason}</span>` : ''}${combined?.sampleRateAssumed ? `<br><span style="color:var(--orange, #b36a00);font-size:9px;">&#9888; Sample rate is an assumed preset, not detected or entered — dependent frequency citations are unverified until confirmed.</span>` : ''}</div>
        </div>
        <div class="mc-combined-zone" style="background:${zoneBg[combined?.worstZone]||'rgba(85,85,85,0.1)'};border-color:${zoneColors[combined?.worstZone]||'#555'};color:${zoneColors[combined?.worstZone]||'#555'}">
          ${ok.length ? 'Zone ' + (combined?.worstZone||'&mdash;') : (activeAlerts.length ? 'ALERT' : 'OK')}
        </div>
      </div>
      <div class="mc-ch-score-row">
        ${ok.map((ch,i)=>{const col=MC_CH_COLORS[i]||MC_CH_COLORS[0];return`<div class="mc-ch-score-cell"><div class="mc-ch-score-dot" style="background:${col.line}"></div><div class="mc-ch-score-loc">${ch.location}<br><span class="mc-ch-score-axis">${ch.axis}</span></div><div class="mc-ch-score-hi" style="color:${hiColor(ch.healthIdx)}">${ch.healthIdx}</div><div class="mc-ch-score-zone" style="color:${zoneColors[ch.zoneRow?.zone_label]||'#888'}">Zone ${ch.zoneRow?.zone_label||'?'}</div><div class="mc-ch-score-rms">${ch.rms} mm/s</div></div>`;}).join('')}
        ${thresholds.map(t=>`<div class="mc-ch-score-cell"><div class="mc-ch-score-dot" style="background:${t.alert?'#ef4444':'#22c55e'}"></div><div class="mc-ch-score-loc">${t.location}<br><span class="mc-ch-score-axis">${t.label}</span></div><div class="mc-ch-score-hi" style="color:${t.alert?'#ef4444':'#22c55e'}">${t.alert?'ALERT':'OK'}</div><div class="mc-ch-score-zone" style="color:var(--muted)">${t.direction==='below'?'&le;':'&ge;'} ${t.thresholdValue}</div><div class="mc-ch-score-rms">${t.value.toFixed?.(1) ?? t.value}</div></div>`).join('')}
      </div>
      <div class="mc-combined-metrics">
        <div class="mc-metric-box"><div class="mc-metric-val" style="color:${hiColor(combined?.healthIdx||0)}">${combined?.healthIdx??'&mdash;'}</div><div class="mc-metric-label">Combined Health</div></div>
        <div class="mc-metric-box"><div class="mc-metric-val">${combined?.minRUL??'&mdash;'}<span class="mc-metric-unit">d</span></div><div class="mc-metric-label">Min RUL</div></div>
        <div class="mc-metric-box"><div class="mc-metric-val">${ok.length}</div><div class="mc-metric-label">Vib. Channels OK</div></div>
        <div class="mc-metric-box"><div class="mc-metric-val" style="color:${activeAlerts.length?'#ef4444':'inherit'}">${activeAlerts.length}</div><div class="mc-metric-label">Threshold Alerts</div></div>
      </div>
      ${combined?.topFault?`<div class="mc-top-fault"><span class="mc-fault-icon">&#9888;</span><div style="flex:1"><div class="mc-fault-name">${combined.topFault.name}${combined.topFault.crossAxis?'<span class="mc-xaxis-badge">Cross-Axis</span>':''}</div><div class="mc-fault-meta">${combined.topFault.location||''}${combined.topFault.axes?' &middot; Axes: '+combined.topFault.axes.join(', '):combined.topFault.axis?' &middot; '+combined.topFault.axis:''} &middot; ${combined.topFault.pct?.toFixed(0)}% confidence${combined.topFault.clause?'<span class="mc-iso-ref">'+combined.topFault.clause+'</span>':''}</div></div><div class="mc-fault-pct-bar"><div style="width:${combined.topFault.pct}%;background:${window.faultIndicatorColor?window.faultIndicatorColor(combined.topFault.pct):'#f59e0b'}"></div></div></div>`:''}
    </div>

    ${combined?.crossAxisFindings?.length?`<div class="mc-section-header"><span>&#128279; Cross-Axis Fault Confirmation</span><span class="mc-section-clause">ISO 13373-1:2002 &sect;6.3</span></div><div class="mc-cross-axis-grid">${combined.crossAxisFindings.map(f=>`<div class="mc-cross-card"><div class="mc-cross-loc">${f.location}</div><div class="mc-cross-axes">${f.axes.join(' + ')} axes</div><div class="mc-cross-name">${f.rule.label}</div><div class="mc-cross-pct">${f.boostedPct.toFixed(0)}% <span class="mc-boost-tag">+${f.rule.boostPct}% boosted</span></div><div class="mc-cross-note">${f.rule.note}</div><div class="mc-iso-ref">${f.rule.clause}</div></div>`).join('')}</div>`:''}

    ${ok.length ? `
    <div class="mc-charts-row" style="grid-template-columns:1fr;">
      <div class="mc-chart-card" style="grid-column:1/-1;">
        <div class="mc-chart-header" style="flex-wrap:wrap;gap:8px;align-items:center;">
          <span class="mc-chart-title">Fault Severity Radar &amp; FFT Spectrum</span>
          <div id="mc-chart-tabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-left:8px;"></div>
          <span class="mc-section-clause" style="margin-left:auto;">ISO 13379-1 &middot; ISO 13373-2</span>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;margin-top:8px;">
          <div style="flex:1;">
            <div class="mc-chart-legend" id="mc-radar-legend" style="margin-bottom:4px;"></div>
            <div style="position:relative;height:270px;padding:6px"><canvas id="mc-radarChart"></canvas></div>
          </div>
          <div style="flex:1;">
            <div class="mc-chart-legend" id="mc-fft-legend" style="margin-bottom:4px;"></div>
            <div style="position:relative;height:270px;padding:6px"><canvas id="mc-fftChart"></canvas></div>
          </div>
        </div>
      </div>
    </div>` : `<div class="mc-section-header"><span>No vibration channels configured — charts unavailable</span></div>`}

    <div class="mc-section-header"><span>&#128312; Per-Channel Breakdown</span><span class="mc-section-clause">Independent pipeline per axis</span></div>
    <div class="mc-channels-grid">
      ${ok.map((ch,i)=>{const col=MC_CH_COLORS[i]||MC_CH_COLORS[0];return`<div class="mc-ch-card" style="border-left:3px solid ${col.line}"><div class="mc-ch-card-header"><div class="mc-ch-color-dot" style="background:${col.line}"></div><span class="mc-ch-loc">${ch.location}</span><span class="mc-ch-axis">${ch.axis}</span><span class="mc-ch-zone" style="color:${zoneColors[ch.zoneRow?.zone_label]||'#888'}">Zone ${ch.zoneRow?.zone_label||'?'}</span></div><div class="mc-ch-col">${ch.col}</div><div class="mc-ch-metrics"><div class="mc-ch-met"><div class="mc-ch-met-val">${ch.rms}</div><div class="mc-ch-met-lbl">RMS mm/s</div></div><div class="mc-ch-met"><div class="mc-ch-met-val">${ch.cf}</div><div class="mc-ch-met-lbl">Crest F.</div></div><div class="mc-ch-met"><div class="mc-ch-met-val">${ch.kurt}</div><div class="mc-ch-met-lbl">Kurtosis</div></div><div class="mc-ch-met"><div class="mc-ch-met-val" style="color:${hiColor(ch.healthIdx)}">${ch.healthIdx}</div><div class="mc-ch-met-lbl">Health</div></div></div><div class="mc-ch-faults">${(ch.faults||[]).filter(f=>!f.locked&&f.pct>=(window.CONFIG?.minimum_fault_confidence_pct||10)).slice(0,3).map(f=>`<div class="mc-ch-fault-row"><span class="mc-ch-fault-name">${f.name}</span><div class="mc-ch-fault-bar"><div style="width:${f.pct}%;background:${window.faultIndicatorColor?window.faultIndicatorColor(f.pct):'#f59e0b'}"></div></div><span class="mc-ch-fault-pct">${f.pct.toFixed(0)}%</span></div>`).join('')||'<div style="font-size:10px;color:var(--muted);margin-top:4px;">No significant faults detected</div>'}</div><div class="mc-ch-rul">RUL: <strong>${ch.rulR?.days??'&mdash;'}d</strong> &plusmn;${ch.rulR?.ci??'&mdash;'}d &middot; ${ch.trendRow?.code||'DDU'}</div></div>`;}).join('')}
      ${channelResults.filter(r=>r.error&&r.type==='vibration').map(ch=>`<div class="mc-ch-card mc-ch-error"><div class="mc-ch-card-header"><span class="mc-ch-loc">${ch.location}</span><span class="mc-ch-axis">${ch.axis}</span></div><div class="mc-ch-col">${ch.col}</div><div style="color:var(--red);font-size:11px;margin-top:6px;">&#10007; ${ch.error}</div></div>`).join('')}
      ${thresholds.map(t=>`<div class="mc-ch-card" style="border-left:3px solid ${t.alert?'#ef4444':'#22c55e'}"><div class="mc-ch-card-header"><div class="mc-ch-color-dot" style="background:${t.alert?'#ef4444':'#22c55e'}"></div><span class="mc-ch-loc">${t.location}</span><span class="mc-ch-axis">${t.label}</span><span class="mc-ch-zone" style="color:${t.alert?'#ef4444':'#22c55e'}">${t.alert?'ALERT':'OK'}</span></div><div class="mc-ch-col">${t.col}</div><div class="mc-ch-metrics"><div class="mc-ch-met"><div class="mc-ch-met-val" style="color:${t.alert?'#ef4444':'inherit'}">${typeof t.value==='number'?t.value.toFixed(1):t.value}</div><div class="mc-ch-met-lbl">Reading</div></div><div class="mc-ch-met"><div class="mc-ch-met-val">${t.direction==='below'?'&le;':'&ge;'} ${t.thresholdValue}</div><div class="mc-ch-met-lbl">Limit</div></div></div><div style="font-size:10px;color:var(--muted);margin-top:6px;">Threshold alert only — no fault classification for this channel type</div></div>`).join('')}
      ${thresholdErrors.map(t=>`<div class="mc-ch-card mc-ch-error"><div class="mc-ch-card-header"><span class="mc-ch-loc">${t.location}</span><span class="mc-ch-axis">${t.label}</span></div><div class="mc-ch-col">${t.col}</div><div style="color:var(--red);font-size:11px;margin-top:6px;">&#10007; ${t.error}</div></div>`).join('')}
    </div>

    <div class="mc-ai-section" id="mc-ai-section">
      <div class="mc-ai-header">
        <span class="mc-ai-icon">&#129504;</span>
        <span class="mc-ai-title">AI Multi-Channel Analysis</span>
        <span class="mc-ai-badge">Claude AI &middot; Streaming</span>
      </div>
      <div class="mc-ai-body" id="mc-ai-body">
        <span style="color:var(--muted)">Generating multi-channel diagnostic summary&hellip;</span>
      </div>
      <div class="disclaimer-last" style="display:none;">AxiomAnare &middot; AI-assisted diagnostic report &middot; Not a certified engineering determination</div>
    </div>
  `;

  // Reset tab state and build tabs + charts — vibration channels only
  mcActiveChIdx = -1;
  requestAnimationFrame(() => {
    mcBuildChartTabs(ok);
    mcBuildRadar(ok);
    mcBuildFFT(ok);
  });
}

// ── MC Chart Tab State ───────────────────────────────────────
// activeChIdx: -1 = All channels, 0..N-1 = single channel
let mcActiveChIdx = -1;
let mcChResults = [];  // stored for tab switches

function mcBuildChartTabs(channelResults) {
  const el = document.getElementById('mc-chart-tabs');
  if (!el) return;
  mcChResults = channelResults;

  const tabStyle = (active) =>
    `display:inline-block;padding:3px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;border:1px solid;transition:all 0.15s;` +
    (active
      ? `background:#4d9de0;color:#fff;border-color:#4d9de0;`
      : `background:transparent;color:#7f93aa;border-color:#30363d;`);

  const tabs = [{ label: 'All', idx: -1 },
    ...channelResults.map((ch, i) => ({ label: `${ch.location} (${ch.axis})`, idx: i }))
  ];

  el.innerHTML = tabs.map(t =>
    `<span id="mc-tab-${t.idx === -1 ? 'all' : t.idx}"
      style="${tabStyle(mcActiveChIdx === t.idx)}"
      onclick="mcSetChartTab(${t.idx})">${t.label}</span>`
  ).join('');
}

window.mcSetChartTab = function(idx) {
  mcActiveChIdx = idx;
  // Update tab styles
  const tabs = document.querySelectorAll('[id^="mc-tab-"]');
  tabs.forEach(t => {
    const tIdx = t.id === 'mc-tab-all' ? -1 : parseInt(t.id.replace('mc-tab-',''));
    const active = tIdx === idx;
    t.style.background      = active ? '#4d9de0' : 'transparent';
    t.style.color           = active ? '#fff'     : '#7f93aa';
    t.style.borderColor     = active ? '#4d9de0'  : '#30363d';
  });
  const subset = idx === -1 ? mcChResults : [mcChResults[idx]];
  mcBuildRadar(subset);
  mcBuildFFT(subset);
};

// ── MC Radar Chart ────────────────────────────────────────────
function mcBuildRadar(channelResults) {
  if (mcRadarInst) { mcRadarInst.destroy(); mcRadarInst = null; }
  const canvas = document.getElementById('mc-radarChart');
  if (!canvas || !channelResults.length) return;

  const faultMap = {};
  channelResults.forEach(ch => (ch.faults||[]).filter(f=>!f.locked).forEach(f => {
    if (!faultMap[f.name] || faultMap[f.name] < f.pct) faultMap[f.name] = f.pct;
  }));
  const sorted     = Object.entries(faultMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const labels     = sorted.map(([n])=>n.split(' - ').pop().trim().split(' ').slice(0,3).join(' '));
  const faultNames = sorted.map(([n])=>n);

  const maxScore = Math.max(...Object.values(faultMap), 1);
  const scaleMax = Math.max(40, Math.ceil(maxScore / 10) * 10 + 10);
  const floor    = scaleMax * 0.12;
  const remap    = pct => pct > 0 ? Math.max(floor, pct) : 0;

  const severityColor = pct =>
    pct >= 65 ? '#ef4444' : pct >= 40 ? '#f97316' : pct >= 20 ? '#f59e0b' : '#4d9de0';

  const datasets = channelResults.map((ch, i) => {
    // When showing a single channel use severity-coded dots; all channels use channel colours
    const col = mcActiveChIdx === -1 ? (MC_CH_COLORS[i] || MC_CH_COLORS[0]) : null;
    const data = faultNames.map(n => {
      const f = (ch.faults||[]).find(f => f.name === n);
      return f ? remap(f.pct) : 0;
    });
    const dotColors = data.map((v, di) => {
      if (mcActiveChIdx !== -1) {
        // Single channel — severity coded dots
        const f = (ch.faults||[]).find(f => f.name === faultNames[di]);
        return severityColor(f ? f.pct : 0);
      }
      return col.line;
    });
    return {
      label: `${ch.location} (${ch.axis})`,
      data,
      backgroundColor: col ? col.fill : 'rgba(77,157,224,0.15)',
      borderColor:     col ? col.line : '#4d9de0',
      borderWidth: 2,
      pointBackgroundColor: dotColors,
      pointBorderColor:     dotColors,
      pointBorderWidth: 0,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointStyle: 'circle',
    };
  });

  const realPct = (datasetIndex, dataIndex) => {
    const ch = channelResults[datasetIndex];
    if (!ch) return 0;
    const f = (ch.faults||[]).find(f => f.name === faultNames[dataIndex]);
    return f ? f.pct : 0;
  };

  const stepSize = scaleMax <= 40 ? 10 : 20;

  mcRadarInst = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2030', borderColor: '#4d9de0', borderWidth: 1,
          callbacks: {
            label: c => ` ${c.dataset.label}: ${window.faultIndicatorLabel ? window.faultIndicatorLabel(realPct(c.datasetIndex, c.dataIndex)) : realPct(c.datasetIndex, c.dataIndex).toFixed(0)+'%'} (${realPct(c.datasetIndex, c.dataIndex).toFixed(0)}%)`,
          }
        }
      },
      scales: {
        r: {
          min: 0, max: scaleMax,
          ticks: { stepSize, backdropColor: 'rgba(26,36,53,0.8)', color: '#7f93aa', font: { size: 9 }, callback: v => v + '%' },
          grid:        { color: 'rgba(77,157,224,0.15)' },
          angleLines:  { color: 'rgba(77,157,224,0.2)'  },
          pointLabels: { color: '#e8edf5', font: { size: 10, weight: '600' } },
        }
      }
    }
  });

  const leg = document.getElementById('mc-radar-legend');
  if (leg) leg.innerHTML = channelResults.map((ch, i) => {
    const col = MC_CH_COLORS[i] || MC_CH_COLORS[0];
    return `<div class="mc-legend-item"><div class="mc-legend-dot" style="background:${col.line}"></div>${ch.location} (${ch.axis})</div>`;
  }).join('');
}

// ── MC FFT Chart — overlaid spectra ──────────────────────────
function mcBuildFFT(channelResults) {
  if (mcFftInst) { mcFftInst.destroy(); mcFftInst = null; }
  const canvas = document.getElementById('mc-fftChart');
  if (!canvas || !channelResults.length) return;
  const sr     = channelResults[0].sr;
  const fftRef = channelResults[0].fftR;
  if (!fftRef?.freqs?.length) return;
  const maxFreq = sr * 0.45;
  const step    = Math.max(1, Math.floor(fftRef.freqs.length / 300));
  const freqLabels = [];
  for (let i = 0; i < fftRef.freqs.length && fftRef.freqs[i] < maxFreq; i += step)
    freqLabels.push(fftRef.freqs[i].toFixed(1));

  // When single channel — colour bars by frequency zone (like single-channel FFT)
  const datasets = channelResults.map((ch, i) => {
    const allCols = MC_CH_COLORS;
    // Find original index in mcChResults for correct colour
    const origIdx = mcChResults.indexOf(ch);
    const col = allCols[origIdx >= 0 ? origIdx : i] || allCols[0];
    const data = [];
    for (let j = 0; j < ch.fftR.freqs.length && ch.fftR.freqs[j] < maxFreq; j += step)
      data.push(parseFloat(ch.fftR.mags[j].toFixed(5)));
    return {
      label: `${ch.location} (${ch.axis})`,
      data,
      borderColor:     col.line,
      backgroundColor: col.fill,
      borderWidth: channelResults.length === 1 ? 2 : 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1,
      fill: channelResults.length === 1,  // fill under curve when single channel
    };
  });

  mcFftInst = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: freqLabels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2030', borderColor: '#4d9de0', borderWidth: 1,
          callbacks: {
            title:  items => items[0]?.label + ' Hz',
            label:  c => ` ${c.dataset.label}: ${parseFloat(c.raw).toFixed(4)}`,
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12, color: '#7f93aa', font: { size: 9 }, callback: (v,i) => parseFloat(freqLabels[i]) % 50 < 3 ? freqLabels[i] + 'Hz' : '' } },
        y: { grid: { color: 'rgba(77,157,224,0.1)' }, ticks: { color: '#7f93aa', font: { size: 9 } }, min: 0 }
      }
    }
  });

  const leg = document.getElementById('mc-fft-legend');
  if (leg) leg.innerHTML = channelResults.map((ch, i) => {
    const origIdx = mcChResults.indexOf(ch);
    const col = MC_CH_COLORS[origIdx >= 0 ? origIdx : i] || MC_CH_COLORS[0];
    return `<div class="mc-legend-item"><div class="mc-legend-line" style="background:${col.line}"></div>${ch.location} (${ch.axis})</div>`;
  }).join('');
}

// ── Stream Claude for multi-channel ──────────────────────────
async function mcStreamClaude(channelResults, combined, filename) {
  const bodyEl = document.getElementById('mc-ai-body');
  if (!bodyEl) return;

  const WORKER_URL = 'https://restless-tree-eac8.kairosventure-io.workers.dev';

  // Build a compact prompt — vibration channels drive fault/zone data
  const ok = channelResults.filter(r => !r.error && r.type === 'vibration');
  const thresholds = channelResults.filter(r => r.type === 'threshold' && !r.error);

  const chSummary = ok.map(ch =>
    `  • ${ch.location} (${ch.axis}): Zone ${ch.zoneRow?.zone_label}, RMS=${ch.rms} mm/s, CF=${ch.cf}, Kurt=${ch.kurt}, HI=${ch.healthIdx}, Top fault: ${(ch.faults||[]).find(f=>!f.locked)?.name || 'None'} (${(ch.faults||[]).find(f=>!f.locked)?.pct?.toFixed(0)||0}%)`
  ).join('\n') || '  None.';

  const thresholdSummary = thresholds.map(t =>
    `  • ${t.location} (${t.label}): reading ${typeof t.value==='number'?t.value.toFixed(1):t.value}, limit ${t.direction==='below'?'≥ ':'≤ '}${t.thresholdValue} — ${t.alert ? 'ALERT (limit exceeded)' : 'OK'}`
  ).join('\n') || '  None configured.';

  const crossSummary = (combined?.crossAxisFindings || []).map(f =>
    `  • ${f.rule.label} at ${f.location} (${f.axes.join('+')}): ${f.boostedPct.toFixed(0)}% confidence [${f.rule.clause}]`
  ).join('\n');

  // Build diagnostic flags — same policy as single-channel
  const topFaultPct = ok.length ? Math.max(...ok.map(ch => (ch.faults||[]).find(f=>!f.locked)?.pct || 0)) : 0;
  const crossMaxPct = Math.max(...(combined?.crossAxisFindings||[]).map(f => f.boostedPct), 0);
  const rmsZone = combined?.worstZoneRMS || combined?.worstZone;  // use pre-override RMS zone
  const displayZone = combined?.worstZone;
  const thresholdAlerts = thresholds.filter(t => t.alert);
  const flags = [];

  if (combined?.zoneOverrideReason) {
    flags.push(`ZONE_OVERRIDE_ACTIVE: RMS zone is ${rmsZone} but displayed zone is ${displayZone} due to fault confidence. ${combined.zoneOverrideReason}. YOU MUST reflect this in your assessment — do NOT write a "healthy" or "Zone A" summary.`);
  }
  if ((rmsZone === 'A' || rmsZone === 'B') && (topFaultPct >= 40 || crossMaxPct >= 40)) {
    flags.push('EARLY_WARNING: RMS is low but fault confidence is significant. FORBIDDEN: do not use words like "excellent", "optimal", "normal operation", or "no immediate action". Fault indicators require scheduled intervention per ISO 13373-1:2002 §6.3.');
  }
  if (ok.length && topFaultPct < 40 && crossMaxPct < 40) {
    flags.push('LOW_CONFIDENCE: Top fault below 40% — use indicative language only.');
  }
  if (crossMaxPct >= 60) {
    flags.push('CROSS_AXIS_CONFIRMED: Cross-axis fault confidence ≥60% — this is a CONFIRMED fault, not indicative. Report it as requiring corrective action.');
  }
  if (thresholdAlerts.length) {
    flags.push(`THRESHOLD_ALERT: ${thresholdAlerts.length} threshold channel(s) exceeded their configured limit (see threshold data below). Mention this explicitly — it is a separate finding from vibration fault classification, not folded into the zone/health assessment.`);
  }

  const prompt = `You are AxiomAssist — an ISO-certified vibration analyst. Provide a concise multi-channel diagnostic summary (3 paragraphs).

File: ${filename} | Vibration channels: ${ok.length} | Threshold channels: ${thresholds.length} | Displayed Zone: ${displayZone ?? 'N/A (no vibration channels)'} | RMS Zone: ${rmsZone ?? 'N/A'} | Combined Health: ${combined?.healthIdx ?? 'N/A'} | Min RUL: ${combined?.minRUL ?? 'N/A'}d

Per-channel vibration data:
${chSummary}

Threshold-alert channels (temperature/proximity/etc. — simple limit check, not fault-classified):
${thresholdSummary}

Cross-axis confirmed faults (ISO 13373-1):
${crossSummary || '  None confirmed.'}

=== CRITICAL FLAGS — MUST OBEY ===
${flags.length ? flags.map(f => '(!) ' + f).join('\n') : '  No flags.'}

=== RULES ===
1. Base your condition assessment on the DISPLAYED ZONE (${displayZone ?? 'N/A'}), not the RMS zone. If there are no vibration channels, say so plainly rather than inventing a zone assessment.
2. If cross-axis faults are confirmed at ≥40%, they are a priority finding — not optional.
3. FORBIDDEN words when EARLY_WARNING or ZONE_OVERRIDE_ACTIVE flag is set: "excellent", "optimal", "no immediate action", "continued operation without intervention", "normal operation".
4. Use indicative language only for faults below 40% confidence.
5. Threshold-channel alerts are a distinct finding from vibration fault classification — report them separately, don't merge them into the zone assessment.
6. Always cite ISO standards where applicable. Paragraph 1: vibration condition + zone assessment. Paragraph 2: cross-axis interpretation + threshold-alert findings. Paragraph 3: inspection priority.`;

  try {
    bodyEl.innerHTML = '<span style="color:var(--muted)">Connecting to AI…</span>';
    let fullText = '';

    // Retry up to 2 times — Worker may cold-start on first attempt
    let response;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout
      try {
        response = await fetch('https://restless-tree-eac8.kairosventure-io.workers.dev/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: window.CONFIG?.chatbot_config?.model_version || 'claude-sonnet-4-20250514',
            max_tokens: window.CONFIG?.chatbot_config?.max_output_tokens || 1000,
            stream: true,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        clearTimeout(timeout);
        if (response.ok) break; // success — exit retry loop
        const errText = await response.text();
        if (attempt === 2) throw new Error('Worker returned ' + response.status + ': ' + errText);
        // Wait 2s before retry
        await new Promise(r => setTimeout(r, 2000));
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (attempt === 2) throw fetchErr;
        bodyEl.innerHTML = '<span style="color:var(--muted)">Retrying AI connection…</span>';
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    bodyEl.innerHTML = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const ev = JSON.parse(data);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            fullText += ev.delta.text;
            bodyEl.innerHTML = window.mdToHtml ? window.mdToHtml(fullText) : fullText;
          }
        } catch {}
      }
    }
    bodyEl.innerHTML = window.mdToHtml ? window.mdToHtml(fullText) : fullText;
  } catch (err) {
    bodyEl.textContent = 'AI summary unavailable: ' + err.message;
  }
}

// ── Toggle multi-channel mode ─────────────────────────────────
window.mcSetEnabled = function(enabled) {
  MC.enabled = enabled;
  const mapSection = document.getElementById('mc-mapping-section');
  if (mapSection) mapSection.style.display = enabled ? 'block' : 'none';
  // Update run button label
  const runBtn = document.getElementById('run-btn');
  if (runBtn) runBtn.innerHTML = enabled
    ? '&#9889; Run Multi-Channel Analysis'
    : '&#9889; Run Analysis';
  // If enabling manually and we have raw data, re-run file ready to populate mapping
  if (enabled && MC.rawData && window._lastParsedResult) {
    const sigCols = mcDetectSignalColumns(window._lastParsedResult);
    const assignable = mcGetAssignableColumns(window._lastParsedResult);
    if (assignable.length > 0) {
      mcRenderMappingUI(sigCols, window._lastParsedResult);
    }
  }
};

// ── Show multi-channel suggestion banner after file parse ─────
window.mcShowSuggestion = function(signalColumns) {
  const el = document.getElementById('multiChannelSuggestion');
  if (!el) return;
  if (signalColumns.length <= 1) { el.style.display = 'none'; return; }
  // Auto-activate multi-channel — no manual step needed
  mcActivate(signalColumns);
  // Show quiet info banner
  el.style.display = 'flex';
  el.innerHTML = `<span>&#128290; <strong>${signalColumns.length} signal columns detected</strong> — multi-channel mode activated automatically</span>`;
};

window.mcActivate = function(columns) {
  // Enable the toggle in step 2
  const toggle = document.getElementById('mc-mode-toggle');
  if (toggle) { toggle.checked = true; mcSetEnabled(true); }
  mcRenderMappingUI(columns, window._lastParsedResult || {});
  // Scroll to mapping
  const ms = document.getElementById('mc-mapping-section');
  if (ms) ms.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── Called by modified stageFile after file is read ───────────
window.mcOnFileReady = function(raw, parsedResult) {
  MC.rawData = raw;
  window._lastParsedResult = parsedResult; // was never set before — mcSetEnabled's re-render path relies on it
  const sigCols = mcDetectSignalColumns(parsedResult);
  const assignable = mcGetAssignableColumns(parsedResult);
  // Populate mapping whenever there's at least one assignable column — not just
  // vibration-looking ones, since a lone vibration channel + a temperature/proximity
  // channel is a legitimate 2-channel setup even though sigCols.length would be 1.
  if (assignable.length > 0) {
    mcRenderMappingUI(sigCols, parsedResult);
  }
  if (assignable.length > 1) {
    // Auto-enable multi-channel — no user action needed
    MC.enabled = true;
    const toggle = document.getElementById('mc-mode-toggle');
    if (toggle) toggle.checked = true;
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.innerHTML = '&#9889; Run Multi-Channel Analysis';
    // Show quiet info strip
    const el = document.getElementById('multiChannelSuggestion');
    if (el) {
      el.style.display = 'flex';
      el.innerHTML = '<span>&#128290; <strong>' + assignable.length + ' channels detected</strong> — running multi-channel analysis automatically</span>';
    }
  } else {
    // Single channel — normal mode
    MC.enabled = false;
    const toggle = document.getElementById('mc-mode-toggle');
    if (toggle) toggle.checked = false;
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.innerHTML = '&#9889; Run Analysis';
  }
};
