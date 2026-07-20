// ══ SUPABASE CONFIG ══════════════════════════════════════════════════════
const SUPABASE_URL = 'https://zjfhxutcvjxootoekade.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmh4dXRjdmp4b290b2VrYWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjgzODAsImV4cCI6MjA5MDcwNDM4MH0.5yGgSjALJhTQm5Ud3W-fU2Bgo-3PkziaS0oLrGMYQ9o';

// ══ FREEMIUM GATE ════════════════════════════════════════════════════════
const FREE_ANALYSIS_LIMIT = 5;

const Freemium = {
  getCount() {
    try { return parseInt(localStorage.getItem('ax_analysis_count') || '0', 10); } catch(e) { return 0; }
  },
  increment() {
    try {
      const n = this.getCount() + 1;
      localStorage.setItem('ax_analysis_count', n);
      return n;
    } catch(e) { return 1; }
  },
  isPro() {
    // Primary: check cached tier written by syncTier() after auth resolves
    try {
      const t = localStorage.getItem('ax_tier');
      if (t && t !== 'free') return true;
      // Legacy fallback: ax_pro flag (set by older auth flows)
      if (localStorage.getItem('ax_pro') === 'true') return true;
    } catch(e) {}
    return false;
  },
  isFree() { return !this.isPro(); },
  remaining() { return Math.max(0, FREE_ANALYSIS_LIMIT - this.getCount()); },
  isLocked() { return this.isFree() && this.getCount() >= FREE_ANALYSIS_LIMIT; },

  // ── syncTier ─────────────────────────────────────────────────────────────
  // Called once on page load (after auth.js is ready).
  // Reads the live Supabase tier via window.Auth.getTier() and caches it in
  // localStorage so all synchronous isPro() calls see the correct value.
  // Also refreshes the nav badge and removes freemium overlays if user is paid.
  async syncTier() {
    try {
      if (typeof window.Auth === 'undefined' || typeof window.Auth.getTier !== 'function') return;
      const tier = await window.Auth.getTier();           // null if not logged in
      const paid = tier && tier !== 'free';
      try {
        localStorage.setItem('ax_tier', tier || 'free');
        if (paid) localStorage.setItem('ax_pro', 'true');
        else localStorage.removeItem('ax_pro');
      } catch(e) {}
      if (typeof window.updateFreeBadge === 'function') window.updateFreeBadge();
      // If user just became paid, remove any lingering freemium overlays
      if (paid) {
        const wm = document.getElementById('ax-watermark');   if (wm) wm.remove();
        const tb = document.getElementById('ax-trial-banner');if (tb) tb.remove();
        const mo = document.getElementById('ax-upgrade-modal');if (mo) mo.remove();
        const pb = document.getElementById('pdf-btn');
        if (pb) { pb.style.opacity = ''; pb.style.cursor = ''; pb.title = ''; pb.dataset.gated = ''; pb.onclick = null; }
      }
    } catch(e) {
      console.warn('[Freemium] syncTier failed (non-blocking):', e.message);
    }
  },

  showUpgradeModal(reason) {
    const existing = document.getElementById('ax-upgrade-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'ax-upgrade-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:#161b22;border:1px solid #4d9de0;border-radius:16px;padding:36px 32px;max-width:460px;width:100%;position:relative;text-align:center;">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;color:#4d9de0;margin-bottom:12px;">LYNXEYE</div>
        <div style="font-family:'Exo 2',sans-serif;font-weight:800;font-size:26px;color:#e8edf5;margin-bottom:10px;line-height:1.1;">
          ${reason === 'limit' ? 'Free trial complete' : 'Unlock Full Access'}
        </div>
        <p style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7f93aa;line-height:1.8;margin-bottom:24px;">
          ${reason === 'limit'
            ? 'You\'ve completed 5 free diagnostic analyses. Sign up for Professional to continue with unlimited diagnostics, PDF export, and fleet management.'
            : 'PDF export, fleet management, and baseline tracking are available on Professional and Enterprise plans.'}
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="landing.html#pricing" style="display:block;padding:13px;background:#4d9de0;color:#fff;border-radius:9px;font-family:'Exo 2',sans-serif;font-weight:700;font-size:14px;text-decoration:none;transition:background 0.2s;" onmouseover="this.style.background='#2b7cc4'" onmouseout="this.style.background='#4d9de0'">
            &#9889; View Plans &amp; Pricing
          </a>
          <button onclick="document.getElementById('ax-upgrade-modal').remove()" style="padding:11px;background:transparent;color:#7f93aa;border:1px solid #30363d;border-radius:9px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;">
            ${reason === 'limit' ? 'View this result only' : 'Maybe later'}
          </button>
        </div>
        <div style="margin-top:20px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a4f68;line-height:1.6;">
          Already have an account? <a href="fleet.html" style="color:#4d9de0;text-decoration:none;">Sign in to Fleet Dashboard</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
};



const SB = {
  headers() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },
  async get(table, params='') {
    try {
      const r = await fetch(SUPABASE_URL+'/rest/v1/'+table+'?'+params, { headers: this.headers() });
      return r.ok ? r.json() : null;
    } catch(e) { return null; }
  },
  async post(table, body) {
    try {
      const r = await fetch(SUPABASE_URL+'/rest/v1/'+table, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body)
      });
      return r.ok ? r.json() : null;
    } catch(e) { return null; }
  },
  async patch(table, params, body) {
    try {
      const r = await fetch(SUPABASE_URL+'/rest/v1/'+table+'?'+params, {
        method: 'PATCH', headers: this.headers(), body: JSON.stringify(body)
      });
      return r.ok ? r.json() : null;
    } catch(e) { return null; }
  }
};
// ══ END SUPABASE CONFIG ═══════════════════════════════════════════════════

const CONFIG = {
  iso_machine_classes: [
    { class_id:"cls_i",    display_label:"Class I",        iso_standard_ref:"ISO 10816-3:2009", machine_type_desc:"Small Machines",          power_kw_desc:"Up to 15 kW",      power_kw_min:0,   power_kw_max:15,   mounting_type:"Rigid Mount"    },
    { class_id:"cls_ii",   display_label:"Class II",       iso_standard_ref:"ISO 10816-3:2009", machine_type_desc:"Medium Machines",         power_kw_desc:"15 - 300 kW",      power_kw_min:15,  power_kw_max:300,  mounting_type:"Rigid Mount"    },
    { class_id:"cls_ii_f", display_label:"Class II (Flex)",iso_standard_ref:"ISO 10816-3:2009", machine_type_desc:"Medium Machines",         power_kw_desc:"15 - 300 kW",      power_kw_min:15,  power_kw_max:300,  mounting_type:"Flexible Mount" },
    { class_id:"cls_iii",  display_label:"Class III",      iso_standard_ref:"ISO 10816-3:2009", machine_type_desc:"Large Machines",          power_kw_desc:"Above 300 kW",     power_kw_min:300, power_kw_max:50000,mounting_type:"Rigid Mount"    },
    { class_id:"cls_iv",   display_label:"Class IV",       iso_standard_ref:"ISO 10816-3:2009", machine_type_desc:"Large Machines",          power_kw_desc:"Above 300 kW",     power_kw_min:300, power_kw_max:50000,mounting_type:"Flexible Mount" }
  ],
  iso_severity_zones: [
    { zone_id:"zi_a",  class_id:"cls_i",    zone_label:"A", rms_lower_mm_s:0,    rms_upper_mm_s:0.71,  action_required:"No action required. Newly commissioned or well-maintained.",                     iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.1" },
    { zone_id:"zi_b",  class_id:"cls_i",    zone_label:"B", rms_lower_mm_s:0.71, rms_upper_mm_s:1.8,   action_required:"Satisfactory for continuous operation.",                                        iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.2" },
    { zone_id:"zi_c",  class_id:"cls_i",    zone_label:"C", rms_lower_mm_s:1.8,  rms_upper_mm_s:4.5,   action_required:"Unsatisfactory for long-term operation. Corrective action required.",            iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.3" },
    { zone_id:"zi_d",  class_id:"cls_i",    zone_label:"D", rms_lower_mm_s:4.5,  rms_upper_mm_s:99999, action_required:"Dangerous. Risk of machine damage. Immediate shutdown warranted.",               iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.4" },
    { zone_id:"zii_a", class_id:"cls_ii",   zone_label:"A", rms_lower_mm_s:0,    rms_upper_mm_s:2.3,   action_required:"No action required. Newly commissioned or well-maintained.",                     iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.1" },
    { zone_id:"zii_b", class_id:"cls_ii",   zone_label:"B", rms_lower_mm_s:2.3,  rms_upper_mm_s:7.1,   action_required:"Satisfactory for continuous operation. Maintenance planning recommended.",        iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.2" },
    { zone_id:"zii_c", class_id:"cls_ii",   zone_label:"C", rms_lower_mm_s:7.1,  rms_upper_mm_s:11.2,  action_required:"Unsatisfactory - acceptable for short periods only. Corrective action required.", iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.3" },
    { zone_id:"zii_d", class_id:"cls_ii",   zone_label:"D", rms_lower_mm_s:11.2, rms_upper_mm_s:99999, action_required:"Dangerous. Risk of machine damage. Immediate shutdown warranted.",               iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.4" },
    { zone_id:"ziif_a",class_id:"cls_ii_f", zone_label:"A", rms_lower_mm_s:0,    rms_upper_mm_s:3.5,   action_required:"No action required.",                                                           iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.1" },
    { zone_id:"ziif_b",class_id:"cls_ii_f", zone_label:"B", rms_lower_mm_s:3.5,  rms_upper_mm_s:11.2,  action_required:"Satisfactory for continuous operation.",                                        iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.2" },
    { zone_id:"ziif_c",class_id:"cls_ii_f", zone_label:"C", rms_lower_mm_s:11.2, rms_upper_mm_s:18.0,  action_required:"Unsatisfactory - corrective action required.",                                  iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.3" },
    { zone_id:"ziif_d",class_id:"cls_ii_f", zone_label:"D", rms_lower_mm_s:18.0, rms_upper_mm_s:99999, action_required:"Dangerous. Immediate shutdown warranted.",                                      iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.4" },
    { zone_id:"ziii_a",class_id:"cls_iii",  zone_label:"A", rms_lower_mm_s:0,    rms_upper_mm_s:3.5,   action_required:"No action required.",                                                           iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.1" },
    { zone_id:"ziii_b",class_id:"cls_iii",  zone_label:"B", rms_lower_mm_s:3.5,  rms_upper_mm_s:11.2,  action_required:"Satisfactory for continuous operation.",                                        iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.2" },
    { zone_id:"ziii_c",class_id:"cls_iii",  zone_label:"C", rms_lower_mm_s:11.2, rms_upper_mm_s:18.0,  action_required:"Unsatisfactory - corrective action required.",                                  iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.3" },
    { zone_id:"ziii_d",class_id:"cls_iii",  zone_label:"D", rms_lower_mm_s:18.0, rms_upper_mm_s:99999, action_required:"Dangerous. Immediate shutdown warranted.",                                      iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.4" },
    { zone_id:"ziv_a", class_id:"cls_iv",   zone_label:"A", rms_lower_mm_s:0,    rms_upper_mm_s:3.5,   action_required:"No action required.",                                                           iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.1" },
    { zone_id:"ziv_b", class_id:"cls_iv",   zone_label:"B", rms_lower_mm_s:3.5,  rms_upper_mm_s:14.0,  action_required:"Satisfactory for continuous operation.",                                        iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.2" },
    { zone_id:"ziv_c", class_id:"cls_iv",   zone_label:"C", rms_lower_mm_s:14.0, rms_upper_mm_s:22.4,  action_required:"Unsatisfactory - corrective action required.",                                  iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.3" },
    { zone_id:"ziv_d", class_id:"cls_iv",   zone_label:"D", rms_lower_mm_s:22.4, rms_upper_mm_s:99999, action_required:"Dangerous. Immediate shutdown warranted.",                                      iso_clause_ref:"ISO 10816-3:2009 Table 1 S5.4" }
  ],
  fault_frequency_rules: [

    // -- MECHANICAL FAULTS (detectable from vibration) ----------------------
    // category: "mechanical" | requires: "vibration"
    { rule_id:"r_loose_found", fault_type:"Loose Foundation",      category:"mechanical", requires:"vibration",
      freq_multiplier:0.5,  harmonic_count:8, bandwidth_pct:0.10, confidence_weight:0.35,
      detection_note:"Sub-harmonic and multiple harmonics of shaft speed indicate structural looseness",
      iso_reference:"ISO 13379-1:2012 S5.4" },
    { rule_id:"r_imbal",       fault_type:"Mechanical Unbalance",  category:"mechanical", requires:"vibration",
      freq_multiplier:1.0,  harmonic_count:1, bandwidth_pct:0.12, confidence_weight:0.50,
      detection_note:"Dominant 1x shaft frequency component",
      iso_reference:"ISO 13379-1:2012 S5.2" },
    { rule_id:"r_misalign",    fault_type:"Shaft Misalignment",    category:"mechanical", requires:"vibration",
      freq_multiplier:2.0,  harmonic_count:3, bandwidth_pct:0.12, confidence_weight:0.45,
      detection_note:"Elevated 2x and 3x shaft frequency harmonics",
      iso_reference:"ISO 13379-1:2012 S5.3" },

    // -- BEARING FAULTS (detectable from vibration) -------------------------
    { rule_id:"r_bpfo", fault_type:"Bearing - Outer Race",         category:"bearing",   requires:"vibration",
      freq_multiplier:3.5,  harmonic_count:3, bandwidth_pct:0.15, confidence_weight:0.40,
      detection_note:"Ball pass frequency outer race harmonics; elevated kurtosis confirms impacting",
      iso_reference:"ISO 13379-1:2012 Annex A SA.3" },
    { rule_id:"r_bpfi", fault_type:"Bearing - Inner Race",         category:"bearing",   requires:"vibration",
      freq_multiplier:5.5,  harmonic_count:3, bandwidth_pct:0.15, confidence_weight:0.40,
      detection_note:"Ball pass frequency inner race harmonics with shaft-rate sidebands",
      iso_reference:"ISO 13379-1:2012 Annex A SA.3" },
    { rule_id:"r_bsf",  fault_type:"Bearing - Rolling Element",    category:"bearing",   requires:"vibration",
      freq_multiplier:2.4,  harmonic_count:2, bandwidth_pct:0.15, confidence_weight:0.30,
      detection_note:"Ball spin frequency - indicates rolling element surface defect",
      iso_reference:"ISO 13379-1:2012 Annex A SA.3" },
    { rule_id:"r_ftf",  fault_type:"Bearing - Cage Defect",        category:"bearing",   requires:"vibration",
      freq_multiplier:0.4,  harmonic_count:2, bandwidth_pct:0.20, confidence_weight:0.30,
      detection_note:"Fundamental train frequency - indicates cage wear or damage",
      iso_reference:"ISO 13379-1:2012 Annex A SA.3" },

    // -- ELECTRICAL FAULT INDICATORS (vibration-derived  -  indirect) ---------
    // These are detectable from vibration as the mechanical effects of electrical faults.
    // Confidence is lower than direct MCSA measurement. Labelled as "vibration-derived".
    { rule_id:"r_rotor_bar",   fault_type:"Electrical - Rotor Bar",    category:"electrical", requires:"vibration",
      freq_multiplier:1.0,  harmonic_count:4, bandwidth_pct:0.08, confidence_weight:0.20,
      detection_note:"Rotor bar defects create amplitude modulation at 1x +/- slip frequency. Vibration-derived indicator  -  confirm with MCSA.",
      iso_reference:"IEC 60034-14:2003 S5.2" },
    { rule_id:"r_stator_ecc",  fault_type:"Electrical - Stator Eccentricity", category:"electrical", requires:"vibration",
      freq_multiplier:2.0,  harmonic_count:2, bandwidth_pct:0.10, confidence_weight:0.18,
      detection_note:"Air gap variation from stator eccentricity produces vibration at twice line frequency (100/120 Hz). Vibration-derived indicator.",
      iso_reference:"IEC 60034-14:2003 S5.1" },

    // -- ELECTRICAL FAULTS REQUIRING MCSA/POWER DATA ------------------------
    // These CANNOT be determined from vibration alone. Shown as locked/greyed.
    { rule_id:"r_volt_unbal",  fault_type:"Voltage Unbalance",          category:"electrical", requires:"mcsa",
      freq_multiplier:null, harmonic_count:0, bandwidth_pct:0, confidence_weight:0,
      detection_note:"Requires voltage measurement data (Va, Vb, Vc). Cannot be derived from vibration.",
      iso_reference:"IEC 60034-14:2003 S5.4" },
    { rule_id:"r_curr_unbal",  fault_type:"Current Unbalance",          category:"electrical", requires:"mcsa",
      freq_multiplier:null, harmonic_count:0, bandwidth_pct:0, confidence_weight:0,
      detection_note:"Requires current measurement data (Ia, Ib, Ic). Cannot be derived from vibration.",
      iso_reference:"IEC 60034-14:2003 S5.4" },
    { rule_id:"r_pwr_factor",  fault_type:"Power Factor",               category:"process",    requires:"power",
      freq_multiplier:null, harmonic_count:0, bandwidth_pct:0, confidence_weight:0,
      detection_note:"Requires real and reactive power measurements. Cannot be derived from vibration.",
      iso_reference:"ISO 55001:2014 S8.1" },
    { rule_id:"r_active_pwr",  fault_type:"Active Power / Efficiency",  category:"process",    requires:"power",
      freq_multiplier:null, harmonic_count:0, bandwidth_pct:0, confidence_weight:0,
      detection_note:"Requires watt-meter or power analyser data. Cannot be derived from vibration.",
      iso_reference:"ISO 55001:2014 S8.1" }
  ],

  // -- data_type_detection  -  column name patterns that identify input type --
  data_type_detection: {
    vibration: ['accel','acc','vib','vibration','velocity','vel','amplitude','amp','rms','g','mm/s','signal'],
    mcsa:      ['current','ia','ib','ic','i_a','i_b','i_c','amps','ampere','phase_current'],
    voltage:   ['voltage','va','vb','vc','v_a','v_b','v_c','volt','v_line','vln'],
    power:     ['power','kw','watt','active_power','power_factor','pf','reactive','kva','kvars'],
    frequency: ['freq','frequency','hz','f_line']
  },
  unit_conversion_factors: [
    { from_unit:"mm/s", to_unit:"mm/s", multiplier:1.0,    offset:0, canonical_flag:1 },
    { from_unit:"m/s",  to_unit:"mm/s", multiplier:1000.0, offset:0, canonical_flag:0 },
    { from_unit:"in/s", to_unit:"mm/s", multiplier:25.4,   offset:0, canonical_flag:0 },
    { from_unit:"g",    to_unit:"mm/s", multiplier:null,   offset:0, canonical_flag:0 },
    { from_unit:"m/s2", to_unit:"mm/s", multiplier:null,   offset:0, canonical_flag:0 },
    { from_unit:"mg",   to_unit:"g",    multiplier:0.001,  offset:0, canonical_flag:0 }
  ],
  baseline_deviation_thresholds: [
    { classification:"Within Baseline",       sd_lower:0,   sd_upper:1.0, iso_reference:"ISO 13373-2:2016 S8.1" },
    { classification:"Minor Deviation",       sd_lower:1.0, sd_upper:2.0, iso_reference:"ISO 13373-2:2016 S8.1" },
    { classification:"Significant Deviation", sd_lower:2.0, sd_upper:3.5, iso_reference:"ISO 13373-2:2016 S8.1" },
    { classification:"Step-Change",           sd_lower:3.5, sd_upper:9999,iso_reference:"ISO 13373-2:2016 S8.1" }
  ],
  trend_state_rules: [
    { code:"SWB", label:"Stable Within Baseline",       slope_lower:-0.04, slope_upper:0.04,  sd_trigger:null, description:"Regression slope negligible.",                                   iso_reference:"ISO 13373-2:2016 S8.2" },
    { code:"DDU", label:"Deviating - Direction Unclear", slope_lower:null,  slope_upper:null,  sd_trigger:1.0,  description:"Single snapshot - trend direction cannot be established.",     iso_reference:"ISO 13373-2:2016 S8.2" },
    { code:"PRS", label:"Progressing - Steady",         slope_lower:0.04,  slope_upper:0.15,  sd_trigger:null, description:"Positive slope sustained. Maintenance planning recommended.", iso_reference:"ISO 13373-2:2016 S8.2" },
    { code:"PRA", label:"Progressing - Accelerating",   slope_lower:0.15,  slope_upper:9999,  sd_trigger:null, description:"Slope steepening. Corrective action required.",                iso_reference:"ISO 13373-2:2016 S8.2" },
    { code:"RGI", label:"Regressing - Improving",       slope_lower:-9999, slope_upper:-0.04, sd_trigger:null, description:"Consistent downward trend. Monitor to confirm.",               iso_reference:"ISO 13373-2:2016 S8.2" },
    { code:"SCO", label:"Step-Change Outside Baseline",  slope_lower:null,  slope_upper:null,  sd_trigger:3.5,  description:"Sudden departure. Manual review required.",                   iso_reference:"ISO 13373-2:2016 S8.2" }
  ],
  early_warning_rule: { trigger_deviation_classes:["Significant Deviation","Step-Change"], trigger_trend_states:["PRS","PRA"], trigger_zones:["A","B"], iso_reference:"ISO 13379-1:2012 S6.4" },
  rul_zone_base_days: [ { zone:"A", base_days:365, iso_reference:"ISO 13381-1:2015 S5.2" }, { zone:"B", base_days:180, iso_reference:"ISO 13381-1:2015 S5.2" }, { zone:"C", base_days:60, iso_reference:"ISO 13381-1:2015 S5.2" }, { zone:"D", base_days:7, iso_reference:"ISO 13381-1:2015 S5.2" } ],
  rul_trend_modifiers: [ { trend_code:"SWB", multiplier:1.00 }, { trend_code:"DDU", multiplier:0.90 }, { trend_code:"PRS", multiplier:0.65 }, { trend_code:"PRA", multiplier:0.40 }, { trend_code:"RGI", multiplier:1.30 }, { trend_code:"SCO", multiplier:0.20 } ],
  rul_ci_fraction: 0.22,
  kurtosis_thresholds: [ { label:"Normal", lower:0, upper:3.0, score_bonus:0, iso_reference:"ISO 13373-2:2016 S7.4" }, { label:"Minor impacting", lower:3.0, upper:4.0, score_bonus:15, iso_reference:"ISO 13373-2:2016 S7.4" }, { label:"Elevated", lower:4.0, upper:6.0, score_bonus:30, iso_reference:"ISO 13373-2:2016 S7.4" }, { label:"High impacting", lower:6.0, upper:9999, score_bonus:50, iso_reference:"ISO 13373-2:2016 S7.4" } ],
  crest_factor_thresholds: [ { label:"Normal", lower:0, upper:3.5, score_bonus:0, iso_reference:"ISO 13373-2:2016 S7.3" }, { label:"Elevated", lower:3.5, upper:5.0, score_bonus:10, iso_reference:"ISO 13373-2:2016 S7.3" }, { label:"High", lower:5.0, upper:9999, score_bonus:20, iso_reference:"ISO 13373-2:2016 S7.3" } ],
  monitoring_intervals: [ { condition:"zone_D", interval_desc:"Continuous until shutdown", iso_reference:"ISO 13373-1:2002 S7.3" }, { condition:"zone_C", interval_desc:"Daily", iso_reference:"ISO 13373-1:2002 S7.3" }, { condition:"trend_PRA", interval_desc:"Every 3 days", iso_reference:"ISO 13373-1:2002 S7.3" }, { condition:"trend_PRS", interval_desc:"Weekly", iso_reference:"ISO 13373-1:2002 S7.3" }, { condition:"zone_B_or_below", interval_desc:"Monthly", iso_reference:"ISO 13373-1:2002 S7.3" } ],
  minimum_fault_confidence_pct: 8,
  fault_display_limit: 6,
  ddu_min_samples: 500,
  rul_bar_scale_days: null,
  default_sample_rate_hz: 1000,
  shaft_freq_search_min_hz: 5,
  shaft_freq_search_max_hz: 200,
  harmonic_comb_count: 4,
  gravity_mm_s2: 9806.65,
  chatbot_config: { model_version:"claude-sonnet-5", max_output_tokens:1000, disclaimer_text:"AI-GENERATED ANALYSIS - IMPORTANT NOTICE: This output is intended to assist qualified maintenance and reliability engineers. It does not constitute a certified engineering determination. All corrective actions must be reviewed and authorised by a suitably qualified professional. Kairos Ventures Pte Ltd accepts no liability for any decision arising from reliance on this output without independent qualified engineering review." },

  // Envelope demodulation bands -- ISO 13373-2:2016 §7.5
  // race: high-freq resonance band for race faults (BPFO, BPFI)
  // roll: mid-freq band for rolling element / cage faults (BSF, FTF)
  envelope_bands: { race: { lo: 3000, hi: 4500 }, roll: { lo: 200, hi: 1800 }, rollHigh: { lo: 1800, hi: 5000 } },

  // Bearing BER suppression threshold -- ISO 13379-1:2012 §5.2
  // When bearing envelope BER > threshold, mechanical scores capped at 10%
  bearing_ber_threshold: 1.3,

  // Single-reading baseline fallback std — ISO 13373-2:2016 §8.1
  // When only one baseline reading exists, use this % of mean as effective std
  baseline_single_reading_std_pct: 0.05,

  // Multi-channel cross-axis confirmation rules -- ISO 13373-1:2002 §6.3
  // requiredAxes: minimum number of axes that must show the fault to confirm
  // boostPct: confidence boost applied when confirmed across axes
  // faultThreshold: minimum per-channel fault pct to count toward confirmation
  mc_max_channels: 12, // ceiling for the channel-count dropdown (was 6) — 2x triaxial + temp/proximity headroom
  mc_cross_axis_fault_threshold_pct: 10,
  mc_cross_axis_rules: [
    { id:'ca_imbalance',   category:'mechanical', faultName:'Mechanical Unbalance',  requiredAxes:2, boostPct:15, label:'Rotational Imbalance — Cross-Axis Confirmation', clause:'ISO 13373-1:2002 §6.3.2', note:'Imbalance confirmed on ≥2 orthogonal axes — confidence elevated' },
    { id:'ca_misalignment',category:'mechanical', faultName:'Shaft Misalignment',    requiredAxes:2, boostPct:20, label:'Misalignment — Axial Confirmation',               clause:'ISO 13373-1:2002 §6.3.3', note:'Misalignment confirmed across radial + axial — confidence elevated' },
    { id:'ca_bearing',     category:'bearing',    faultName:null,                    requiredAxes:2, boostPct:18, label:'Bearing Fault — Multi-Axis Presence',             clause:'ISO 13373-1:2002 §6.3.5', note:'Bearing fault confirmed on multiple axes — confidence elevated' },
    { id:'ca_looseness',   category:'mechanical', faultName:'Loose Foundation',      requiredAxes:2, boostPct:12, label:'Mechanical Looseness — Cross-Axis Signature',     clause:'ISO 13373-1:2002 §6.3.6', note:'Looseness confirmed on ≥2 axes — confidence elevated' },
  ],

  // Health index label/colour thresholds (used by MC worst-channel inject)
  health_thresholds: [
    { min:75, label:'Good',    color:'var(--green)'  },
    { min:50, label:'Monitor', color:'#f59e0b'       },
    { min:25, label:'Caution', color:'var(--red)'    },
    { min:0,  label:'Critical',color:'var(--red)'    },
  ],

  // Multi-channel fault-zone override thresholds — ISO 13379-1:2012 §5.4
  // When fault confidence exceeds these levels, the displayed zone is escalated
  // even if RMS-based zone is lower (same policy as single-channel applyFaultOverride)
  fault_zone_override: {
    bearing_threshold:  60,  // escalate Zone A/B → C when bearing/confirmed fault ≥60%
    elevated_threshold: 40,  // escalate Zone A → B (caution) when any fault ≥40%
  },
};


// LynxEye  -  Diagnostic Engine
// All logic runs after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
// Set measurement date default to today
(function() { const el = document.getElementById('p-meas-date'); if (el) el.value = new Date().toISOString().split('T')[0]; })();
initBearingLibrary();   // pre-load bearing library from Supabase for wizard lookup

// ── Supabase keep-alive ping ──────────────────────────────────────────────
// Free tier pauses after 7 days inactivity. Ping every 4 days to prevent pause.
// Lightweight read-only query on bearing_library (smallest table).
(function supabaseKeepAlive() {
  const ping = () => SB.get('bearing_library', 'limit=1').then(r =>
    console.log('[Supabase] keep-alive ping:', r ? 'OK' : 'no response')
  ).catch(() => {});
  ping(); // immediate ping on load
  setInterval(ping, 4 * 24 * 60 * 60 * 1000); // every 4 days
})();
// ── End keep-alive ────────────────────────────────────────────────────────

// == CONFIG LOOKUP HELPERS ==
function getZonesForClass(id) {
  return CONFIG.iso_severity_zones.filter(z => z.class_id === id)
    .sort((a, b) => a.rms_lower_mm_s - b.rms_lower_mm_s);
}
function lookupZone(rms, id) {
  const z = getZonesForClass(id);
  return z.find(r => rms >= r.rms_lower_mm_s && rms < r.rms_upper_mm_s) || z[z.length - 1];
}
function classifyDeviation(sd) {
  return [...CONFIG.baseline_deviation_thresholds]
    .sort((a, b) => a.sd_lower - b.sd_lower)
    .find(t => sd >= t.sd_lower && sd < t.sd_upper)
    || CONFIG.baseline_deviation_thresholds[CONFIG.baseline_deviation_thresholds.length - 1];
}
function toCanonicalUnit(v, unit, hz) {
  const r = CONFIG.unit_conversion_factors.find(x => x.from_unit === unit);
  if (!r) return v;
  if (r.multiplier !== null) return v * r.multiplier;
  // g/m/s² single-sample conversion — only used for isolated values, not signal arrays.
  // Signal arrays use integrateAccelToVelocity() for correct broadband integration.
  const hzValid = hz && hz >= CONFIG.shaft_freq_search_min_hz && hz <= CONFIG.shaft_freq_search_max_hz;
  if (unit === 'g'   && hzValid) return (v * CONFIG.gravity_mm_s2) / (2 * Math.PI * hz);
  if (unit === 'm/s2'&& hzValid) return v / (2 * Math.PI * hz) * 1000;
  return v;
}

// == SPECTRAL VELOCITY RMS FROM ACCELERATION ==
// ISO 10816 velocity RMS computed by frequency-domain integration.
// v(f) = a(f) / (2*pi*f) per FFT bin — each bin gets its own integration factor.
// Spectral RMS = sqrt( sum_band( 0.5 * (mag_mms2[k]/(2*pi*f[k]))^2 ) )
// Integration band: 10–1000 Hz per ISO 10816-3 standard velocity measurement band.
// Returns scalar RMS velocity in mm/s. No IFFT needed — Parseval's theorem.
// ISO 10816-3:2009 §4.2 — velocity RMS is the primary severity metric.
function accelToVelocityRMS(signal, fs, unit) {
  const fftResult = computeFFT(signal, fs);
  const { freqs, mags } = fftResult;
  const gravity = CONFIG.gravity_mm_s2; // 9806.65 mm/s²
  // Scale factor from input unit to mm/s²
  let scale;
  if      (unit === 'g')    scale = gravity;
  else if (unit === 'm/s2') scale = 1000;
  else if (unit === 'mg')   scale = gravity * 0.001;
  else return null; // not acceleration — caller handles
  // Spectral integration: v_rms² = sum of 0.5*(A_peak_mms2/(2pi*f))² over ISO band
  // mags from computeFFT are peak amplitudes (not RMS) of each frequency component
  const fLo = 10, fHi = 1000;
  let sumV2 = 0;
  for (let k = 1; k < freqs.length; k++) {
    const f = freqs[k];
    if (f < fLo) continue;
    if (f > fHi) break;
    const aMag_mms2 = mags[k] * scale; // peak acceleration amplitude in mm/s²
    const vMag_mms  = aMag_mms2 / (2 * Math.PI * f); // peak velocity in mm/s
    sumV2 += 0.5 * vMag_mms * vMag_mms; // 0.5 converts peak² to RMS²
  }
  return Math.sqrt(sumV2); // RMS velocity in mm/s
}
function calcRUL(zone, trend) {
  const b = CONFIG.rul_zone_base_days.find(r => r.zone === zone);
  const m = CONFIG.rul_trend_modifiers.find(r => r.trend_code === trend);
  const days = Math.max(3, Math.round((b?.base_days || 90) * (m?.multiplier || 1)));
  return { days, ci: Math.round(days * CONFIG.rul_ci_fraction), iso_reference: b?.iso_reference || 'ISO 13381-1:2015 S5.2' };
}
function getMonitoringInterval(zone, trend) {
  const c = { zone_D: zone==='D', zone_C: zone==='C', trend_PRA: trend==='PRA',
    trend_PRS: trend==='PRS', zone_B_or_below: ['A','B'].includes(zone) };
  return CONFIG.monitoring_intervals.find(r => c[r.condition]) || CONFIG.monitoring_intervals[CONFIG.monitoring_intervals.length-1];
}
function getCFLabel(cf) { return [...CONFIG.crest_factor_thresholds].sort((a,b)=>b.lower-a.lower).find(t=>cf>=t.lower)?.label||'Normal'; }
function getKLabel(k)  { return [...CONFIG.kurtosis_thresholds].sort((a,b)=>b.lower-a.lower).find(t=>k>=t.lower)?.label||'Normal'; }
function getCFBonus(cf) { return [...CONFIG.crest_factor_thresholds].sort((a,b)=>b.lower-a.lower).find(t=>cf>=t.lower)?.score_bonus||0; }
function getKBonus(k)  { return [...CONFIG.kurtosis_thresholds].sort((a,b)=>b.lower-a.lower).find(t=>k>=t.lower)?.score_bonus||0; }

// == STATE ==
let selClassId = CONFIG.iso_machine_classes[1].class_id;
let radarInst = null, fftInst = null, nvr = {};
let pendingFile = null, pendingRaw = null, pendingMatBuffer = false;
let machineParams = {};   // RPM, bearing model, load zone from wizard step 2
let isBaselineUpload = false;  // set true when user ticks baseline checkbox


// == FAULT INDICATOR LABEL ==
// Replaces % confidence with ISO 13379-1:2012 Annex A tier labels.
// Score is spectral evidence strength, not statistical probability.
function faultIndicatorLabel(pct) {
  if (pct >= 85) return 'Critical';
  if (pct >= 65) return 'Strong';
  if (pct >= 40) return 'Elevated';
  if (pct >= 20) return 'Indicative';
  if (pct >= 8)  return 'Low';
  return 'Trace';
}
function faultIndicatorColor(pct) {
  if (pct >= 65) return 'var(--red)';
  if (pct >= 40) return 'var(--orange)';
  if (pct >= 20) return 'var(--yellow)';
  return 'var(--accent)';
}

// ══ SUPABASE BASELINE ENGINE ══════════════════════════════════════════════
// Two-silo data strategy per architecture doc:
//   Customer silo: assets, baselines, nvr_records (private per session)
//   Cumulative silo: fault_signatures (anonymised, contributes to fleet learning)
//
// Baseline = mean ± std of RMS readings from a known-healthy reference state.
// ISO 13373-2:2016 §8.1 — baseline established from stable operating condition.
// Trend = linear regression slope of last N RMS readings.
// ISO 13373-2:2016 §8.2 — trend state requires minimum 3 readings.

// Resolve or create asset in Supabase — returns asset_id
async function resolveAsset(assetName, machineClass, equipType, measPoint) {
  // Look for existing asset by name
  const existing = await SB.get('assets', 'asset_name=eq.'+encodeURIComponent(assetName)+'&select=id,asset_name,baseline_established');
  if (existing && existing.length > 0) return existing[0];
  // Create new asset
  const created = await SB.post('assets', {
    asset_name:    assetName,
    machine_class: machineClass,
    equipment_type: equipType,
    measurement_point: measPoint,
    baseline_established: false
  });
  return created && created[0] ? created[0] : { id: null, asset_name: assetName, baseline_established: false };
}

// Load last N NVR records for this asset — used for trend computation
async function loadAssetHistory(assetId, limit=10) {
  if (!assetId) return [];
  const rows = await SB.get('nvr_records',
    'asset_id=eq.'+assetId+'&order=recorded_at.desc&limit='+limit+'&select=filename,rms_mms,kurtosis,crest_factor,iso_zone,top_fault,top_fault_pct,health_score,recorded_at,is_baseline'
  );
  return rows || [];
}

// Load baseline for asset from Supabase baselines table
async function loadBaseline(assetId) {
  if (!assetId) return null;
  const rows = await SB.get('baselines',
    'asset_id=eq.'+assetId+'&order=established_at.desc&limit=1&select=mean_rms,std_rms,sample_count,established_at'
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

// Save or update baseline from a set of NVR records
async function saveBaseline(assetId, records) {
  if (!assetId || !records.length) return;
  const rmsValues = records.map(r => parseFloat(r.rms_mms)).filter(v => isFinite(v));
  if (rmsValues.length < 1) return;
  const mean = rmsValues.reduce((a,b)=>a+b,0) / rmsValues.length;
  const std  = rmsValues.length > 1
    ? Math.sqrt(rmsValues.reduce((s,v)=>s+(v-mean)**2,0) / rmsValues.length)
    : 0;
  // Upsert baseline
  await SB.post('baselines', {
    asset_id:       assetId,
    mean_rms:       parseFloat(mean.toFixed(4)),
    std_rms:        parseFloat(std.toFixed(4)),
    sample_count:   rmsValues.length,
    established_at: new Date().toISOString()
  });
  // Mark asset as baseline established
  await SB.patch('assets', 'id=eq.'+assetId, { baseline_established: true });
  console.log('Baseline saved: mean='+mean.toFixed(4)+' std='+std.toFixed(4));
}

// Compute trend state from historical RMS values — ISO 13373-2:2016 §8.2
// Returns trend code: SWB / PRS / PRA / RGI / DDU
function computeTrendFromHistory(history) {
  if (!history || history.length < 3) return 'DDU';
  // Use chronological order (history is desc from DB)
  const rmsVals = [...history].reverse().map(r => parseFloat(r.rms_mms));
  const n = rmsVals.length;
  // Linear regression slope (normalised per reading)
  const xMean = (n-1)/2;
  const yMean = rmsVals.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  rmsVals.forEach((y,i) => { num+=(i-xMean)*(y-yMean); den+=(i-xMean)**2; });
  const slope = den > 0 ? num/den : 0;
  const normSlope = slope / (yMean || 1);  // normalise by mean RMS
  // Match to CONFIG trend state rules
  const rules = CONFIG.trend_state_rules.filter(r => r.code !== 'DDU' && r.code !== 'SCO');
  for (const rule of rules) {
    if (rule.slope_lower !== null && rule.slope_upper !== null) {
      if (normSlope >= rule.slope_lower && normSlope < rule.slope_upper) return rule.code;
    }
  }
  return 'SWB'; // default: stable if no rule matched (normSlope exactly at boundary)
}

// Save NVR record to Supabase after analysis
// Also handles baseline establishment if isBaselineUpload=true
async function saveNVRToSupabase(nvr, assetId, isBaseline) {
  try {
    const top = nvr.faults && nvr.faults.find(f => !f.locked && f.pct > 0);
    const record = {
      asset_id:        assetId,
      filename:        nvr.filename,
      file_format:     nvr.filename.split('.').pop(),
      sample_count:    nvr.n,
      sample_rate_hz:  nvr.sr,
      rms_mms:         parseFloat(nvr.rms),
      peak_mms:        parseFloat(nvr.peak),
      crest_factor:    parseFloat(nvr.cf),
      kurtosis:        parseFloat(nvr.kurt),
      deviation_sigma: parseFloat(nvr.devSc),
      iso_zone:        nvr.zoneRow?.zone_label,
      trend_code:      nvr.trendRow?.code,
      rul_days:        nvr.rulR?.days,
      shaft_hz:        nvr.shaftHz,
      top_fault:       top?.name || null,
      top_fault_pct:   top?.pct  || null,
      machine_class:   nvr.classRow?.display_label,
      load_pct:        nvr.machineParams?.loadPct || null,
      is_baseline:     isBaseline || false,
      health_score:    nvr.healthIdx ? nvr.healthIdx.score : null,
      recorded_at:     (nvr.machineParams && nvr.machineParams.measDate ? nvr.machineParams.measDate + 'T12:00:00.000Z' : new Date().toISOString())
    };
    const saved = await SB.post('nvr_records', record);
    if (saved && saved[0]) {
      console.log('NVR saved id:', saved[0].id, '| asset:', assetId);
      // Contribute to cumulative fault silo if fault indicator is Indicative or above
      if (top && top.pct >= 20 && !top.locked) {
        await SB.post('fault_signatures', {
          machine_class:  record.machine_class,
          equipment_type: nvr.machineParams?.equipType || 'unknown',
          fault_type:     top.name,
          fault_category: top.category,
          fault_pct:      top.pct,
          iso_zone:       record.iso_zone,
          shaft_hz:       record.shaft_hz,
          rms_mms:        record.rms_mms,
          kurtosis:       record.kurtosis,
          crest_factor:   record.crest_factor,
          freq_hz:        top.freq_hz,
          harmonics_used: top.harmonics_used,
          bearing_model:  nvr.machineParams?.bearingModel || null
        }).catch(()=>{});
      }
    }
    return saved && saved[0] ? saved[0] : null;
  } catch(e) {
    console.log('Supabase NVR save failed:', e.message);
    return null;
  }
}

// ══ END SUPABASE BASELINE ENGINE ══════════════════════════════════════════

// == CLASS SELECTOR ==
function initClassSelector() {
  document.getElementById('class-grid').innerHTML = CONFIG.iso_machine_classes.map(c => `
    <div class="class-btn${c.class_id===selClassId?' selected':''}" data-id="${c.class_id}" onclick="selectClass('${c.class_id}')">
      <div class="cb-id">${c.display_label}</div>
      <div class="cb-desc">${c.machine_type_desc}</div>
      <div class="cb-kw">${c.power_kw_desc}</div>
      <div class="cb-mount">${c.mounting_type}</div>
    </div>`).join('');
}
window.selectClass = function(id) {
  selClassId = id;
  window.selClassId = id;  // keep multiChannel.js in sync
  document.querySelectorAll('.class-btn').forEach(b => b.classList.toggle('selected', b.dataset.id === id));
  if (pendingFile) updateStep3Meta();
};
initClassSelector();

// == FILE HANDLING ==
window.onDrop = function(e) { e.preventDefault(); if (e.dataTransfer.files[0]) stageFile(e.dataTransfer.files[0]); };
document.getElementById('fileInput').addEventListener('change', function() { if (this.files[0]) stageFile(this.files[0]); });
document.getElementById('run-btn').addEventListener('click', runFromReady);
document.getElementById('new-upload-btn').addEventListener('click', resetApp);
document.getElementById('sample-link').addEventListener('click', loadSampleData);

function updateStep3Meta() {
  const c = CONFIG.iso_machine_classes.find(x => x.class_id === selClassId);
  document.getElementById('ready-class').textContent = c ? 'Class: ' + c.machine_type_desc : ' - ';
  document.getElementById('step3-note').textContent = c ? c.iso_standard_ref + ' . ' + c.mounting_type : ' - ';
}

function stageFile(file) {
  pendingFile = file; pendingRaw = null;
  const ext = file.name.split('.').pop().toLowerCase();
  const sz = file.size > 1048576 ? (file.size/1048576).toFixed(1)+' MB' : (file.size/1024).toFixed(1)+' KB';
  // Update drop zone
  document.getElementById('drop-glyph').textContent = '[OK]';
  document.getElementById('drop-title').textContent = file.name;
  document.getElementById('drop-sub').textContent = sz + ' . click to change';
  document.getElementById('select-btn').textContent = '^ Change File';
  // Populate Step 3
  document.getElementById('ready-filename').textContent = file.name;
  document.getElementById('ready-meta').textContent = sz + ' . .' + ext.toUpperCase();
  updateStep3Meta();
  // ── Auto-suggest asset name from filename ──────────────────────────────
  // Only suggest if field is blank — never overwrite user's entry
  const assetEl = document.getElementById('p-asset-name');
  if (assetEl && !assetEl.value.trim()) {
    // Extract asset ID from filename:
    // Strategy: if the filename contains a dot BEFORE the extension (multi-part name),
    // treat everything before the FIRST dot as the asset ID.
    // e.g. "KA-001.MA342_1200rpm_A_D_00.csv" → "KA-001"
    //      "KA-001.001.csv"                   → "KA-001"
    // Otherwise fall back to stripping extension and parsing by delimiter.
    // e.g. "TJF01_VibrationData_10days.csv"   → "TJF01"
    //      "pump_bearing_NDE_H.csv"            → "pump_bearing_NDE_H"

    const dotParts = file.name.split('.');
    let base;
    if (dotParts.length > 2) {
      // Multi-dot filename — asset ID is everything before the first dot
      base = dotParts[0];
    } else {
      // Single dot (just name.ext) — strip extension normally
      base = file.name.replace(/\.[^.]+$/, '');
    }

    // Split on _ and space only (not hyphen — hyphens are part of IDs like KA-001)
    const parts = base.split(/[_\s]+/);
    // Asset ID heuristic: first segment(s) that are alphanumeric + digits
    // Stop when we hit a purely descriptive word
    const descWords = new Set([
      'vibration','data','vib','signal','accel','velocity','measurement',
      'reading','recording','log','export','output','file','test','sample',
      'bearing','motor','pump','fan','gearbox','compressor','turbine',
      'nde','de','fe','drive','end','axial','radial','horizontal','vertical',
      'rpm','hz','khz','mhz','ms','sec','min','hour','day','days','week',
      'report','raw','csv','xlsx','mat','txt','simul','synthetic',
    ]);
    let suggested = '';
    for (const part of parts) {
      if (!part) continue;
      const pl = part.toLowerCase();
      // Stop if it's a purely descriptive word
      if (descWords.has(pl)) break;
      // Stop if it's a pure number (e.g. date or sequence)
      if (/^\d{4,}$/.test(part)) break;
      suggested = suggested ? suggested + '_' + part : part;
      // Stop after capturing up to 2 segments — keep IDs concise
      if (suggested.split('_').length >= 2) break;
    }
    if (suggested && suggested.length >= 2) {
      assetEl.value = suggested;
      // Trigger param change to update accuracy indicator
      if (typeof onParamChange === 'function') onParamChange();
      // Show subtle hint that this was auto-filled
      const hint = document.getElementById('asset-name-hint');
      if (hint) {
        hint.textContent = 'Auto-suggested from filename — edit if incorrect';
        hint.style.display = 'block';
      }
    }
  }
  // Mark steps done
  setStepDone('step1-num', true); setStepDone('step2-num', true);
  // Show Step 3
  const s3 = document.getElementById('step3-card');
  s3.style.display = 'block';
  setTimeout(() => s3.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
  // Read file
  if (['xlsx','xls'].includes(ext)) {
    const r = new FileReader();
    r.onload = ev => { try { const wb=XLSX.read(ev.target.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; pendingRaw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}).map(row=>row.join(',')).join('\n'); try { const p=parseData(pendingRaw); if(window.mcOnFileReady) mcOnFileReady(pendingRaw,p); } catch(e){} } catch(e){ showFileError('Cannot parse: '+e.message); } };
    r.onerror = () => showFileError('File read failed.');
    r.readAsArrayBuffer(file);
  } else if (ext === 'json') {
    const r = new FileReader();
    r.onload = ev => { try { const a=[].concat(JSON.parse(ev.target.result)); const k=Object.keys(a[0]); pendingRaw=[k.join(','),...a.map(row=>k.map(x=>row[x]).join(','))].join('\n'); } catch { pendingRaw=ev.target.result; } try { const p=parseData(pendingRaw); if(window.mcOnFileReady) mcOnFileReady(pendingRaw,p); } catch(e){} };
    r.onerror = () => showFileError('File read failed.');
    r.readAsText(file);
  } else if (ext === 'mat') {
    const r = new FileReader();
    r.onload = ev => {
      pendingRaw = ev.target.result;
      pendingMatBuffer = true;
      document.getElementById('ready-meta').textContent =
        (file.size/1024).toFixed(0)+'KB  MATLAB .mat  -  Drive End / Fan End channel will be extracted';
    };
    r.onerror = () => showFileError('Cannot read .mat file.');
    r.readAsArrayBuffer(file);
  } else {
    const r = new FileReader();
    r.onload = ev => {
      pendingRaw = ev.target.result;
      // Multi-channel: detect signal columns after text file is ready
      try { const p = parseData(pendingRaw); if (window.mcOnFileReady) mcOnFileReady(pendingRaw, p); } catch(e) {}
    };
    r.onerror = () => showFileError('File read failed.');
    r.readAsText(file);
  }
}

function showFileError(msg) {
  const el = document.getElementById('ready-meta');
  el.textContent = '(!) ' + msg; el.style.color = 'var(--red)';
}

// == MACHINE PARAMETER READER ==
// Reads wizard step 2 inputs: RPM, bearing model, load zone position.
// Returns machineParams object consumed by classifyFaults().
// Rule 1 (no hardcoding): all values from user input or CONFIG bearing library.
// Rule 3 (format agnostic): shaftHz derived from RPM input, not assumed.
function readMachineParams() {
  const params = { shaftHz: 0, bearingMultipliers: null, loadZonePosition: 'centered' };

  // RPM input (id='p-rpm' in index.html) -- convert to shaft Hz
  const rpmEl = document.getElementById('p-rpm');
  if (rpmEl && parseFloat(rpmEl.value) > 0) {
    params.shaftHz = parseFloat(rpmEl.value) / 60;
  }

  // Bearing model (id='p-bearing') -- look up multipliers from client-side bearing library
  // window.BEARING_LIBRARY populated from Supabase on page load (see initBearingLibrary)
  // Falls back gracefully to CONFIG rule defaults when no bearing selected
  const bearingEl = document.getElementById('p-bearing');
  if (bearingEl && bearingEl.value.trim()) {
    const modelStr = bearingEl.value.trim().toLowerCase().replace(/[\s\-]/g, '');
    const lib = window.BEARING_LIBRARY;
    if (lib && Array.isArray(lib)) {
      const match = lib.find(b =>
        b.model && b.model.toLowerCase().replace(/[\s\-]/g, '').includes(modelStr)
      );
      if (match && match.bpfo_mult) {
        params.bearingMultipliers = {
          bpfo: parseFloat(match.bpfo_mult),
          bpfi: parseFloat(match.bpfi_mult),
          bsf:  parseFloat(match.bsf_mult),
          ftf:  parseFloat(match.ftf_mult)
        };
      }
    }
  }

  // Asset name — user-entered or auto-generated from machine parameters
  const assetEl = document.getElementById('p-asset-name');
  const equipEl = document.getElementById('p-equip-type');
  const measEl  = document.getElementById('p-meas-point');
  const assetName = (assetEl && assetEl.value.trim())
    ? assetEl.value.trim()
    : [selClassId, (equipEl&&equipEl.value)||'machine',
       params.shaftHz>0?Math.round(params.shaftHz*60)+'rpm':'',
       (measEl&&measEl.value)||'meas'].filter(Boolean).join('-');
  params.assetName  = assetName;
  params.loadPct    = (() => { const el=document.getElementById('p-load'); return el&&el.value?parseInt(el.value):null; })();
  params.equipType  = (equipEl&&equipEl.value)||'';
  params.measPoint  = (measEl&&measEl.value)||'';
  // Measurement date — user-entered or today
  const measDateEl = document.getElementById('p-meas-date');
  params.measDate = (measDateEl && measDateEl.value) ? measDateEl.value : new Date().toISOString().split('T')[0];
  // Sampling rate — A12: hand-keyed exact value takes priority over dropdown preset.
  // sampleRateIsPreset distinguishes "user typed a real number" (unflagged) from
  // "user picked an Fmax-keyed preset because they didn't have an exact value" (flagged).
  const srEl = document.getElementById('p-sample-rate');
  const srPresetEl = document.getElementById('p-sample-rate-preset');
  if (srEl && srEl.value) {
    params.declaredSampleRate = parseInt(srEl.value);
    params.sampleRateIsPreset = false;
  } else if (srPresetEl && srPresetEl.value) {
    params.declaredSampleRate = parseInt(srPresetEl.value);
    params.sampleRateIsPreset = true;
  } else {
    params.declaredSampleRate = null;
    params.sampleRateIsPreset = false;
  }
  params.loadZonePosition = 'centered';

  return params;
}

// == WIZARD PARAMETER UI FUNCTIONS ==
// These are called from index.html onclick/oninput handlers.

window.toggleParams = function() {
  const form = document.getElementById('param-form');
  const sub  = document.getElementById('param-toggle-sub');
  if (!form) return;
  const isOpen = form.classList.contains('open');
  form.classList.toggle('open', !isOpen);
  if (sub) sub.innerHTML = isOpen ? '&#9660; Expand' : '&#9650; Collapse';
};

window.onBaselineToggle = function() {
  const cb = document.getElementById('baseline-checkbox');
  isBaselineUpload = cb ? cb.checked : !isBaselineUpload;
  const el = document.getElementById('baseline-toggle');
  if (el) el.classList.toggle('active', isBaselineUpload);
  const chk = document.getElementById('baseline-check');
  if (chk) chk.textContent = isBaselineUpload ? '✓' : '';
};

// A12: called by runPipeline when no sample rate is available from any source
// (not hand-keyed, not header/timestamp-detected, no preset chosen). Opens Step 2 and
// marks the sample-rate field as required so the run can be retried once it's filled in.
window.requireSampleRateInput = function() {
  const form = document.getElementById('param-form');
  if (form && !form.classList.contains('open')) { if (typeof toggleParams==='function') toggleParams(); }
  const srEl = document.getElementById('p-sample-rate');
  const srReq = document.getElementById('sample-rate-required-note');
  if (srEl) { srEl.classList.add('input-required'); srEl.focus(); }
  if (srReq) srReq.style.display = 'block';
  const card = document.getElementById('step2-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.onParamChange = function() {
  // Show accuracy indicator when RPM is entered
  const rpm  = parseFloat(document.getElementById('p-rpm')?.value || 0);
  const accEl = document.getElementById('param-accuracy');
  if (accEl) accEl.style.display = rpm > 0 ? 'flex' : 'none';
  // Update step 2 done indicator
  if (rpm > 0) setStepDone('step2-num', true);
  // A12: clear the required-field warning once a sample rate is entered (typed or preset)
  const srEl = document.getElementById('p-sample-rate');
  const srPresetEl = document.getElementById('p-sample-rate-preset');
  const srReq = document.getElementById('sample-rate-required-note');
  if ((srEl && srEl.value) || (srPresetEl && srPresetEl.value)) {
    if (srEl) srEl.classList.remove('input-required');
    if (srReq) srReq.style.display = 'none';
  }
};

window.onBearingInput = function(val) {
  const lookup = document.getElementById('bearing-lookup');
  if (!lookup) return;
  if (!val.trim()) { lookup.style.display = 'none'; return; }
  lookup.style.display = 'block';

  const modelStr = val.trim().toLowerCase().replace(/[\s\-]/g, '');
  const lib = window.BEARING_LIBRARY;
  if (!lib || !Array.isArray(lib)) {
    lookup.innerHTML = '(i) Bearing library loading...';
    lookup.style.color = 'var(--muted)';
    return;
  }
  const match = lib.find(b =>
    b.model && b.model.toLowerCase().replace(/[\s\-]/g, '').includes(modelStr)
  );
  if (match) {
    lookup.innerHTML =
      '[check] <b>' + match.model + '</b> &nbsp;|&nbsp; ' +
      'BPFO: ' + parseFloat(match.bpfo_mult).toFixed(4) + 'x &nbsp; ' +
      'BPFI: ' + parseFloat(match.bpfi_mult).toFixed(4) + 'x &nbsp; ' +
      'BSF: '  + parseFloat(match.bsf_mult).toFixed(4)  + 'x &nbsp; ' +
      'FTF: '  + parseFloat(match.ftf_mult).toFixed(4)  + 'x';
    lookup.style.color = 'var(--green)';
  } else {
    lookup.innerHTML = '(?) No match found. Using CONFIG rule defaults.';
    lookup.style.color = 'var(--muted)';
  }
};

// Load bearing library from Supabase into window.BEARING_LIBRARY on page load
// Makes multipliers available client-side for readMachineParams() lookup
async function initBearingLibrary() {
  try {
    const SUPA_URL = 'https://zjfhxutcvjxootoekade.supabase.co';
    const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmh4dXRjdmp4b290b2VrYWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjgzODAsImV4cCI6MjA5MDcwNDM4MH0.5yGgSjALJhTQm5Ud3W-fU2Bgo-3PkziaS0oLrGMYQ9o';
    const res = await fetch(SUPA_URL + '/rest/v1/bearing_library?select=model,bpfo_mult,bpfi_mult,bsf_mult,ftf_mult&order=model', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if (res.ok) {
      window.BEARING_LIBRARY = await res.json();
    }
  } catch(e) {
    window.BEARING_LIBRARY = [];
  }
}

function runFromReady() {
  if (!pendingFile) return;
  if (!pendingRaw) { document.getElementById('ready-meta').textContent = 'Reading file...'; setTimeout(runFromReady, 300); return; }
  machineParams = readMachineParams();
  window.machineParams = machineParams; // multiChannel.js is a separate script/closure — it can
                                         // only see window.machineParams, never the local variable
                                         // above. Without this line, manual Step 2 entries (RPM,
                                         // sample rate, etc.) never reached the multi-channel path.
  showProcessing(pendingFile.name);
  // Route to multi-channel pipeline when MC mode is active
  if (window.MC && window.MC.enabled) {
    runMultiChannelPipeline(pendingRaw, pendingFile.name);
  } else {
    runPipeline(pendingRaw, pendingFile.name);
  }
}

window.clearFile = function() {
  pendingFile = null; pendingRaw = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('step3-card').style.display = 'none';
  document.getElementById('drop-glyph').textContent = '[folder]';
  document.getElementById('drop-title').textContent = 'Drop file here or click to browse';
  document.getElementById('drop-sub').textContent = 'Any column layout  -  auto-detected';
  document.getElementById('select-btn').textContent = '^ Browse File';
  setStepDone('step1-num', false); setStepDone('step2-num', false);
};

function setStepDone(id, done) {
  const el = document.getElementById(id);
  if (done) { el.classList.add('done'); el.textContent = '[check]'; }
  else { el.classList.remove('done'); el.textContent = id.replace('step','').replace('-num',''); }
}

// == SAMPLE DATA ==
function loadSampleData() {
  const fs = 10000, N = fs * 0.5;
  const shaftHz = 24.5;
  const bpfo = CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_bpfo');
  const imbal = CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_imbal');
  const bpfoHz = shaftHz * bpfo.freq_multiplier;
  const imbalHz = shaftHz * imbal.freq_multiplier;
  const lines = ['timestamp_s,velocity_mm_s'];
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    const v = 1.2*Math.sin(2*Math.PI*imbalHz*t) + 0.5*Math.sin(2*Math.PI*imbalHz*2*t)
            + 2.8*Math.sin(2*Math.PI*bpfoHz*t)*(1+0.4*Math.sin(2*Math.PI*shaftHz*t))
            + (Math.random()-0.5)*0.28;
    lines.push(t.toFixed(5)+','+v.toFixed(4));
  }
  pendingRaw = lines.join('\n');
  pendingFile = { name: 'sample_bearing_fault_NDE_H.csv', size: pendingRaw.length };
  document.getElementById('drop-glyph').textContent = '[OK]';
  document.getElementById('drop-title').textContent = 'sample_bearing_fault_NDE_H.csv';
  document.getElementById('drop-sub').textContent = 'Synthetic BPFO bearing fault  -  '+Math.floor(N)+' samples @ 10 kHz';
  document.getElementById('ready-filename').textContent = 'sample_bearing_fault_NDE_H.csv';
  document.getElementById('ready-meta').textContent = 'Synthetic . '+Math.floor(N)+' samples @ 10 kHz';
  updateStep3Meta();
  setStepDone('step1-num', true); setStepDone('step2-num', true);
  const s3 = document.getElementById('step3-card');
  s3.style.display = 'block';
  setTimeout(() => s3.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
}

// == PIPELINE ==
async function runPipeline(raw, filename) {
  // Freemium gate — block if free limit reached
  if (Freemium.isLocked()) {
    Freemium.showUpgradeModal('limit');
    document.getElementById('processing-screen').style.display = 'none';
    document.getElementById('upload-screen').style.display = 'flex';
    return;
  }
  document.getElementById('proc-filename').textContent = filename;

  // Stage 1  -  Ingest
  await activateStage(1);
  // Route .mat files through dedicated binary MAT parser
  let parsed;
  if (pendingMatBuffer && raw instanceof ArrayBuffer) {
    parsed = parseMat(raw);
    pendingMatBuffer = false;
    // If MAT file contained RPM, inject into machineParams
    if (parsed && parsed.rpmDetected && !(machineParams.shaftHz > 0)) {
      machineParams.shaftHz = parsed.rpmDetected / 60;
    }
  } else {
    parsed = parseData(raw);
  }
  if (!parsed || parsed.values.length < 10) { doneStage(1,'QUARANTINED'); setNote('(!) Cannot extract numeric data.'); return; }
  const cu = CONFIG.unit_conversion_factors.find(r => r.canonical_flag === 1).to_unit;

  // == A12: sample-rate resolution — no silent default ==
  // Priority: user hand-keyed exact value > auto-detected from file (header/timestamp) >
  // user-selected Fmax dropdown preset. If NONE of these are available, this is NOT filled
  // with CONFIG.default_sample_rate_hz — the run is quarantined and the UI is asked to
  // collect a value (required field / dropdown) before analysis can proceed.
  // srSource values: 'declared' (hand-keyed, unflagged) | 'header' | 'timestamp'
  //                  (auto-detected, unflagged) | 'preset' (dropdown, FLAGGED) | null (missing)
  let sr, srSource;
  if (machineParams.declaredSampleRate && !machineParams.sampleRateIsPreset) {
    sr = machineParams.declaredSampleRate; srSource = 'declared';
  } else if (parsed.sampleRate && parsed.sampleRateSource) {
    sr = parsed.sampleRate; srSource = parsed.sampleRateSource;
  } else if (machineParams.declaredSampleRate && machineParams.sampleRateIsPreset) {
    sr = machineParams.declaredSampleRate; srSource = 'preset';
  } else {
    sr = null; srSource = null;
  }
  if (!sr) {
    doneStage(1,'QUARANTINED');
    setNote('(!) Sample rate required — not found in file and not provided. Enter it in Step 2 (Sampling Rate field or Fmax preset) before running analysis.');
    if (typeof requireSampleRateInput === 'function') requireSampleRateInput();
    return;
  }
  // A12 flag: any run on a non-detected, non-hand-keyed value carries a visible,
  // report-level "assumed input" flag — the dropdown makes the assumption chosen and
  // visible rather than silent, but the report must still say so.
  const sampleRateAssumed = (srSource === 'preset');
  // Detect what type of data we have from column headers
  const dataTypes = detectDataTypes(parsed.allHeaders || [parsed.colName]);
  const dataBanner = getDataTypeBanner(dataTypes);
  // ISO 13373-2:2016 §7.2 — detrend full raw signal before all analysis.
  // Removes DC offset and linear drift so kurtosis/CF/peak reflect vibration only.
  const pN = parsed.values.length;
  let pSx=0,pSy=0,pSxy=0,pSxx=0;
  for(let i=0;i<pN;i++){pSx+=i;pSy+=parsed.values[i];pSxy+=i*parsed.values[i];pSxx+=i*i;}
  const pDen=pN*pSxx-pSx*pSx, pSlope=pDen?((pN*pSxy-pSx*pSy)/pDen):0, pInt=(pSy-pSlope*pSx)/pN;
  const detrendedRaw = parsed.values.map((v,i)=>v-(pInt+pSlope*i));
  // For acceleration units: keep vals in original unit (g/m/s²) for kurtosis/CF/peak/FFT.
  // Kurtosis and CF are dimensionless ratios — unit-independent. FFT envelope analysis
  // uses BER (dimensionless ratios) — also unit-independent.
  // RMS velocity for ISO zone comparison is computed separately via spectral integration.
  const isAccel = ['g','m/s2','mg'].includes(parsed.unit);
  let vals;
  if (isAccel) {
    vals = detrendedRaw; // keep in g — dimensionless stats + FFT unaffected by unit
  } else {
    vals = detrendedRaw.map(v => toCanonicalUnit(v, parsed.unit, null));
  }
  // Spectral velocity RMS for ISO zone — ISO 10816-3:2009 §4.2
  // accelToVelocityRMS integrates FFT mags over 10-1000Hz band: v(f)=a(f)/(2pi*f)
  const spectralVelRMS = isAccel ? accelToVelocityRMS(detrendedRaw, sr, parsed.unit) : null;
  const srTag = srSource==='declared' ? '(entered)' : srSource==='preset' ? '(assumed — preset)' : '('+srSource+')';
  doneStage(1, vals.length+' samples . '+parsed.unit+(isAccel?' (spectral vel integration)':'->')+cu+' . '+sr+'Hz '+srTag);

  // Stage 2  -  Baseline Comparison
  await activateStage(2);
  const n = vals.length;
  const mean = vals.reduce((a,b)=>a+b,0)/n;
  const std  = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n) || 1;
  // RMS velocity for ISO zone: use spectral integration for accel units (ISO 10816-3 §4.2)
  // For velocity units: standard time-domain RMS.
  const rmsRaw = Math.sqrt(vals.reduce((s,v)=>s+v*v,0)/n);
  const rms = (spectralVelRMS && spectralVelRMS > 0) ? spectralVelRMS : rmsRaw;
  let peak = 0; for (let i=0; i<vals.length; i++) { const a=Math.abs(vals[i]); if(a>peak) peak=a; }
  // CF and kurtosis: computed from detrended signal (dimensionless — unit-independent)
  // For accel units, peak is in g — CF = peak_g/rms_g (dimensionless ratio, still valid)
  const cfRaw = peak/(rmsRaw||1);
  const cf    = cfRaw; // use raw-unit CF — dimensionless, not affected by unit choice
  const kurt = vals.reduce((s,v)=>s+((v-mean)/std)**4,0)/n;

  // Supabase baseline comparison — ISO 13373-2:2016 §8.1
  // Resolve asset and load baseline/history (non-blocking with fallback)
  let assetRecord = null, baseline = null, history = [];
  let devSc, devRow;
  try {
    assetRecord = await resolveAsset(
      machineParams.assetName || 'unknown',
      selClassId,
      machineParams.equipType || '',
      machineParams.measPoint || ''
    );
    if (assetRecord && assetRecord.id) {
      [baseline, history] = await Promise.all([
        loadBaseline(assetRecord.id),
        loadAssetHistory(assetRecord.id, 10)
      ]);
    }
  } catch(e) { console.log('Supabase baseline load failed:', e.message); }

  if (baseline && parseFloat(baseline.mean_rms) > 0) {
    const blMean = parseFloat(baseline.mean_rms);
    const blStd  = parseFloat(baseline.std_rms);
    if (blStd > 0) {
      // Full sigma comparison — baseline has std from multiple readings
      devSc  = (rms - blMean) / blStd;
      devRow = classifyDeviation(Math.abs(devSc));
      doneStage(2, devRow.classification+' ('+devSc.toFixed(2)+'σ vs baseline '+blMean.toFixed(3)+'±'+blStd.toFixed(3)+' mm/s · '+baseline.sample_count+' samples)');
    } else {
      // std=0 — only one baseline reading so far.
      // Try to derive std from early healthy NVR history (Zone A readings).
      // ISO 13373-2:2016 §8.1: baseline should be established from stable operating condition.
      const healthyHistory = history.filter(r =>
        r.iso_zone === 'A' && parseFloat(r.rms_mms) > 0
      );
      let effectiveStd;
      let stdSource;
      if (healthyHistory.length >= 2) {
        // Compute real std from Zone A historical readings
        const vals = healthyHistory.map(r => parseFloat(r.rms_mms));
        const hMean = vals.reduce((a,b)=>a+b,0) / vals.length;
        effectiveStd = Math.sqrt(vals.reduce((s,v)=>s+(v-hMean)**2,0) / vals.length) || (blMean * CONFIG.baseline_single_reading_std_pct);
        stdSource = 'derived from '+vals.length+' Zone A readings';
        // Note: baseline auto-update removed — baseline only set via user checkbox
        // to prevent contamination from fault readings
      } else {
        // Fallback: ISO 13373-2 §8.1 recommends ±10% as minimum acceptance band
        // for single-reading baselines. Use 5% (tighter) for well-controlled measurements.
        effectiveStd = blMean * CONFIG.baseline_single_reading_std_pct;
        stdSource = 'single reading · ±' + Math.round(CONFIG.baseline_single_reading_std_pct*100) + '% band';
      }
      devSc  = (rms - blMean) / effectiveStd;
      devRow = classifyDeviation(Math.abs(devSc));
      doneStage(2, devRow.classification+' ('+devSc.toFixed(2)+'σ vs baseline '+blMean.toFixed(3)+' mm/s · '+stdSource+')');
    }
  } else {
    // No baseline yet — use signal self-statistics
    devSc  = (rms - mean) / std;
    devRow = classifyDeviation(Math.abs(devSc));
    const baselineNote = isBaselineUpload ? ' · Will set baseline' : ' · No baseline yet';
    doneStage(2, devRow.classification+' ('+devSc.toFixed(2)+'sigma'+baselineNote+')');
  }

  // Stage 3  -  Trend State Assessment — ISO 13373-2:2016 §8.2
  await activateStage(3);
  let trendRow;
  if (history.length >= 3) {
    // Real trend from historical readings
    const trendCode = computeTrendFromHistory(history);
    trendRow = CONFIG.trend_state_rules.find(r => r.code === trendCode) || CONFIG.trend_state_rules.find(r => r.code === 'DDU');
    doneStage(3, trendRow.code+' ('+history.length+' readings) — '+trendRow.label);
  } else {
    // DDU — insufficient history for trend (ISO 13373-2:2016 §8.2)
    trendRow = CONFIG.trend_state_rules.find(r => r.code === 'DDU');
    doneStage(3, 'DDU — '+trendRow.label+' ('+(history.length)+' reading'+(history.length===1?'':'s')+' — need 3+)');
  }

  // Stage 4  -  ISO Zone
  await activateStage(4);
  const zoneRow  = lookupZone(rms, selClassId);
  const classRow = CONFIG.iso_machine_classes.find(c => c.class_id === selClassId);
  const ew = CONFIG.early_warning_rule;
  const earlyWarn = ew.trigger_deviation_classes.includes(devRow.classification)
    && ew.trigger_trend_states.includes(trendRow.code)
    && ew.trigger_zones.includes(zoneRow.zone_label);
  doneStage(4, 'Zone '+zoneRow.zone_label+' . '+rms.toFixed(3)+' '+cu);

  // Stage 5  -  Fault Classification
  await activateStage(5);
  const fftR = computeFFT(vals, sr);
  fftR._rawSignal = vals;   // detrended signal for envelope demodulation — ISO 13373-2:2016 §7.5
  // Shaft frequency: wizard RPM input takes priority over detectShaft()
  if (machineParams.shaftHz > 0) fftR._shaftHz = machineParams.shaftHz;
  const shaftHz = machineParams.shaftHz > 0 ? machineParams.shaftHz : detectShaft(fftR);
  const allFaults = classifyFaults(fftR, cf, kurt, dataTypes, machineParams);
  // Always include ALL unlocked faults (needed for health index + badge + fallback report)
  // Locked faults (MCSA/power) appended after — greyed in UI, excluded from analysis
  // Display threshold (minimum_fault_confidence_pct) is enforced in the fault bars render, not here
  const faults = [
    ...allFaults.filter(f => !f.locked),
    ...allFaults.filter(f => f.locked)
  ];
  const topUnlocked=faults.find(f=>!f.locked)||faults[0];
  doneStage(5, (topUnlocked?.name||' - ')+' · '+faultIndicatorLabel(topUnlocked?.pct||0));

  // Stage 6  -  RUL
  await activateStage(6);
  const rulR = calcRUL(zoneRow.zone_label, trendRow.code);
  doneStage(6, 'RUL '+rulR.days+'d +/- '+rulR.ci+'d');
  setNote('Rendering results...');

  // Apply fault-zone override — ISO 13379-1:2012 §5.4
  // Fault findings take precedence over RMS zone when confidence is high enough.
  const override = applyFaultOverride(zoneRow, rulR, faults, parseFloat(kurt), parseFloat(cf), classRow);
  const finalZoneRow = override.zoneRow;
  const finalRulR    = override.rulR;

  // Compute physics-based health index — fault-driven, not RMS-driven
  // topBearingFault feeds classifyFaults() output directly into the health score
  const topBearingFault = faults.find(f => !f.locked && f.category === 'bearing');
  const healthIdx = calcHealthIndex(
    rms, kurt, cf,
    finalZoneRow.zone_label,
    topBearingFault ? topBearingFault.pct : 0,
    Math.abs(parseFloat(devSc)),
    classRow
  );

  // A12: sample-rate provenance banner — same {type,msg} pattern as dataBanner.
  // Only the 'preset' (dropdown) path is flagged; 'declared' and detected values are not,
  // per A12's resolution: an assumption is only "assumed" when it wasn't measured or exact.
  const sampleRateBanner = sampleRateAssumed
    ? { type:'assumed', msg:'Assumed input — sample rate ('+sr+' Hz) was not detected in the file or hand-entered; it is a preset selected for analysis intent. Dependent frequency citations (BPFO/BPFI/BSF/FTF, shaft frequency) are unverified until a real sample rate is confirmed.' }
    : null;

  nvr = { filename, rms: rms.toFixed(3), peak: peak.toFixed(3), cf: cf.toFixed(2),
    dataTypes, dataBanner,
    kurt: kurt.toFixed(2), devSc: devSc.toFixed(2), devRow,
    zoneRow: finalZoneRow, trendRow,
    earlyWarn, faults: faults.length ? faults : allFaults.slice(0, CONFIG.fault_display_limit),
    fftR, rulR: finalRulR, n, sr, srSource, sampleRateAssumed, sampleRateBanner, classRow, cu, shaftHz,
    override, healthIdx,
    singleFile: history.length < 3,
    historyCount: history.length,
    assetName: machineParams.assetName || null,
    machineParams: {...machineParams},
    _history: history };

  await new Promise(r => setTimeout(r, 250));
  document.getElementById('processing-screen').style.display = 'none';
  const rs = document.getElementById('results-screen');
  rs.style.display = 'block';
  rs.dataset.filename = filename;
  renderResults();

  // Save to Supabase (non-blocking — runs in background)
  (async () => {
    try {
      const savedNVR = await saveNVRToSupabase(nvr, assetRecord?.id || null, isBaselineUpload);
      // If marked as baseline upload, save/update baseline record
      if (isBaselineUpload && assetRecord?.id) {
        const baselineRecords = history.length > 0
          ? [...history, { rms_mms: rms }]   // include current reading
          : [{ rms_mms: rms }];
        await saveBaseline(assetRecord.id, baselineRecords);
        console.log('Baseline established for asset:', assetRecord.asset_name);
        // Reset toggle after baseline is set
        isBaselineUpload = false;
        const bt = document.getElementById('baseline-toggle');
        if (bt) bt.classList.remove('active');
      }
    } catch(e) { console.log('Supabase post-analysis save failed:', e.message); }
  })();
  // Increment free analysis counter
  const count = Freemium.increment();
  // Apply AI reco gate — truncate for free users
  applyFreemiumGates();
  streamClaude();

  // Baseline prompt — Zone A/B, no existing baseline, not a manual baseline upload
  if (!isBaselineUpload && !baseline && ['A','B'].includes(zoneRow.zone_label)) {
    setTimeout(function() {
      if (window.showBaselinePrompt) window.showBaselinePrompt(machineParams.assetName||filename, zoneRow.zone_label);
    }, 3500);
  }
}

// == MAT FILE PARSER ==
// Self-contained MATLAB Level 5 MAT-file parser — no external dependencies.
// Handles CWRU and standard instrument .mat exports.
// Priority: DE_time > FE_time > BA_time > largest array
// Spec: https://www.mathworks.com/help/pdf_doc/matlab/matfile_format.pdf
function parseMat(arrayBuffer) {
  try {
    const buf = arrayBuffer;
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // Verify MAT file header (first 116 bytes = description text)
    const header = String.fromCharCode(...bytes.slice(0,116)).trim();
    if (!header.includes('MATLAB')) throw new Error('Not a valid MATLAB .mat file');

    // Byte 126-127: endian indicator (MI = little endian for PCWIN)
    const le = true;  // CWRU files are little-endian

    let offset = 128; // data starts after 128-byte header
    const variables = {};

    while (offset < buf.byteLength - 8) {
      const dataType = view.getUint32(offset, le);
      const numBytes = view.getUint32(offset + 4, le);
      offset += 8;
      if (numBytes === 0 || dataType === 0) break;
      if (offset + numBytes > buf.byteLength) break;

      if (dataType === 14) {  // miMATRIX = 14
        try {
          const varEnd = offset + numBytes;
          let pos = offset;

          // Array flags
          const flagsBytes = view.getUint32(pos+4, le);
          const arrayClass = bytes[pos+9] & 0xFF;  // mxDOUBLE=6, mxSINGLE=7
          pos += 8 + flagsBytes;
          pos = Math.ceil(pos/8)*8;

          // Dimensions
          const dimBytes = view.getUint32(pos+4, le);
          pos += 8;
          const dims = [];
          for (let d=0; d<dimBytes/4; d++) dims.push(view.getInt32(pos+d*4, le));
          pos += dimBytes;
          pos = Math.ceil(pos/8)*8;

          // Variable name
          const nameBytes = view.getUint32(pos+4, le);
          pos += 8;
          let varName = '';
          for (let n=0; n<nameBytes; n++) { const c=bytes[pos+n]; if(c>0) varName+=String.fromCharCode(c); }
          pos += nameBytes;
          pos = Math.ceil(pos/8)*8;

          // Real data
          if (pos < varEnd) {
            const realType  = view.getUint32(pos, le);
            const realBytes = view.getUint32(pos+4, le);
            pos += 8;
            const totalElements = dims.reduce((a,b)=>a*b, 1);
            const values = new Float64Array(totalElements);
            if ((arrayClass===6||arrayClass===0) && realType===9) {
              for (let i=0;i<totalElements&&i<realBytes/8;i++) values[i]=view.getFloat64(pos+i*8,le);
            } else if (arrayClass===7 && realType===7) {
              for (let i=0;i<totalElements&&i<realBytes/4;i++) values[i]=view.getFloat32(pos+i*4,le);
            } else if (realType===9) {
              for (let i=0;i<totalElements&&i<realBytes/8;i++) values[i]=view.getFloat64(pos+i*8,le);
            }
            if (varName && totalElements > 10) variables[varName] = Array.from(values);
          }
        } catch(e) { /* skip malformed element */ }
      }
      offset += numBytes;
      if (numBytes % 8 !== 0) offset += 8 - (numBytes % 8);
    }

    const keys = Object.keys(variables);
    if (keys.length === 0) throw new Error('No numeric arrays found in MAT file');

    // Channel priority: Drive End > Fan End > Base > largest array
    const deKey  = keys.find(k => /DE_time|_de_time/i.test(k));
    const feKey  = keys.find(k => /FE_time|_fe_time/i.test(k));
    const baKey  = keys.find(k => /BA_time|_ba_time/i.test(k));
    const rpmKey = keys.find(k => /rpm|speed/i.test(k));
    const largestKey = keys.reduce((a,b) => variables[a].length >= variables[b].length ? a : b);
    const chosenKey  = deKey || feKey || baKey || largestKey;

    const values = variables[chosenKey].filter(v => isFinite(v));
    if (values.length < 100) throw new Error('Too few samples in '+chosenKey+': '+values.length);

    const rpm = rpmKey ? variables[rpmKey][0] : null;
    const channelType = deKey?'Drive End':feKey?'Fan End':baKey?'Base':'Primary';

    return { values, colName: chosenKey, unit: 'g', sampleRate: 12000,
             allHeaders: keys, rpmDetected: rpm, channelUsed: chosenKey, channelType };
  } catch(e) {
    console.error('MAT parse error:', e.message);
    return null;
  }
}

// == DATA PARSER ==
function parseData(raw) {
  let rows=[], headers=[], numCols=[];
  try {
    const r = Papa.parse(raw.trim(), {header:true, dynamicTyping:true, skipEmptyLines:true});
    if (r.data?.length > 5) { rows=r.data; headers=r.meta.fields||[]; numCols=headers.filter(h=>rows.slice(0,20).filter(row=>typeof row[h]==='number'&&isFinite(row[h])).length>10); }
  } catch(e) {}
  if (!numCols.length) {
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 5) return null;
    headers = lines[0].split(/[\t,;]/);
    rows = lines.slice(1).map(l => { const p=l.split(/[\t,;]/),o={}; headers.forEach((h,i)=>{const v=parseFloat(p[i]);o[h]=isFinite(v)?v:p[i];}); return o; });
    numCols = headers.filter(h => rows.slice(0,20).filter(r=>typeof r[h]==='number'&&isFinite(r[h])).length > 10);
  }
  if (!numCols.length) return null;
  const tsN=['time','timestamp','t','date','seconds','ms','index','sample','i','n'];
  // Prioritise acceleration columns — best for fault detection
  // Column priority — ISO 10816-3 uses velocity as primary severity metric.
  // Prefer columns whose name explicitly states the unit (mm_s, velocity) to avoid
  // ambiguous g→mm/s conversion on pre-processed or summary datasets.
  // Acceleration columns are preferred only for raw time-series (bearing fault detection).
  const velNames  = ['velocity_mms','velocity','vel_mms','mm_s','mm/s','vel'];
  const accelNames= ['accel','acc','acceleration','g_rms'];
  const vbN       = ['vib','vibration','amplitude','amp','signal','ch','chan','sensor'];
  const axisN     = ['_x','_y','_z','_h','_v','_a'];

  // Pick velocity first if explicitly named — avoids bad g→mm/s conversion on summary data
  let col = numCols.find(c=>velNames.some(p=>c.toLowerCase()===p||c.toLowerCase().includes(p)))
         || numCols.find(c=>accelNames.some(p=>c.toLowerCase().includes(p)))
         || numCols.find(c=>vbN.some(p=>c.toLowerCase().includes(p)))
         || numCols.find(c=>axisN.some(p=>c.toLowerCase().endsWith(p)))
         || numCols.find(c=>!tsN.some(p=>c.toLowerCase().includes(p)))
         || numCols[numCols.length>1?1:0];
  const values = rows.map(r=>r[col]).filter(v=>typeof v==='number'&&isFinite(v));
  if (values.length < 10) return null;
  const cl = col.toLowerCase();
  let unit = 'g'; // default: assume acceleration in g
  if (cl.includes('velocity')||cl.includes('vel_')||cl.includes('_vel')||cl==='vel') unit='mm/s';
  else if (cl.includes('mm_s')||cl==='mm/s') unit='mm/s';
  else if (cl.includes('m/s2')||cl.includes('ms2')) unit='m/s2';
  else if (cl.includes('mg')&&!cl.includes('img')) unit='mg';
  // acceleration_g, accel, acc, g -> stay as 'g'

  // == A12: sample-rate auto-detect — no silent default ==
  // Shared with the multi-channel pipeline (see multiChannel.js) via
  // window.detectSampleRateFromRows, so both paths use one detection strategy.
  const { sampleRate: sr, sampleRateSource: srSource } = window.detectSampleRateFromRows(headers, rows, tsN);

  return { values, colName: col, unit, sampleRate: sr, sampleRateSource: srSource, allHeaders: headers };
}

// == A12: shared sample-rate detection — single source of truth ==
// Used by parseData() (single-channel) and runMultiChannelPipeline() (multi-channel).
// Resolution order: (a) header/field name match, (b) timestamp-column median delta.
// NEVER falls back to CONFIG.default_sample_rate_hz here; that decision belongs to the
// prompt/dropdown layer (runPipeline / runMultiChannelPipeline), not the detector.
window.detectSampleRateFromRows = function(headers, rows, tsN) {
  tsN = tsN || ['time','timestamp','t','date','seconds','ms','index','sample','i','n'];
  let sr = null, srSource = null;

  // Strategy (a): header/field name match — common exported metadata column names.
  // Looks for a numeric column carrying a constant (or near-constant) value under one
  // of these names — i.e. the file repeats its own acquisition rate per row, which some
  // analyser exports do (distinct from a genuine per-row timestamp/signal column).
  const srNames = ['sample_rate','samplerate','fs','sampling_frequency','samplingfrequency'];
  const srCol = headers.find(h => srNames.includes(h.toLowerCase().replace(/[\s]/g,'')));
  if (srCol) {
    const srVals = rows.slice(0,20).map(r=>parseFloat(r[srCol])).filter(isFinite);
    if (srVals.length) {
      const first = srVals[0];
      // Require near-constant value (metadata columns don't vary row to row) and a
      // plausible acquisition-rate magnitude, else this isn't really a sample-rate field.
      if (srVals.every(v=>Math.abs(v-first) < first*0.001) && first >= 100 && first <= 500000) {
        sr = Math.round(first); srSource = 'header';
      }
    }
  }

  // Strategy (b): timestamp column → fs = 1 / median(Δt). Median (not mean, not a single
  // two-row delta) so a handful of irregular/duplicated rows don't skew the estimate.
  if (!sr) {
    const tc = headers.find(h=>tsN.some(p=>h.toLowerCase()===p||h.toLowerCase().startsWith(p)));
    if (tc) {
      const ts = rows.slice(0,50).map(r=>parseFloat(r[tc])).filter(isFinite);
      if (ts.length > 5) {
        const deltas = [];
        for (let i=1;i<ts.length;i++){ const d=ts[i]-ts[i-1]; if (isFinite(d) && d>0) deltas.push(d); }
        if (deltas.length >= 3) {
          const sorted = deltas.slice().sort((a,b)=>a-b);
          const mid = Math.floor(sorted.length/2);
          const medianDt = sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
          // Column may be in seconds (dt < 1) or milliseconds (dt >= 1, typically < 1000)
          if (medianDt > 0 && medianDt < 1) { sr = Math.round(1/medianDt); srSource = 'timestamp'; }
          else if (medianDt >= 1 && medianDt < 1000) { sr = Math.round(1000/medianDt); srSource = 'timestamp'; }
        }
      }
    }
  }

  return { sampleRate: sr, sampleRateSource: srSource };
};

// == FFT ==
function computeFFT(signal, fs) {
  const N = Math.pow(2, Math.floor(Math.log2(Math.min(signal.length, 8192))));
  // ISO 13373-2:2016 §7.2 — signal conditioning: remove DC offset and linear trend
  // before windowing. A non-zero mean creates a dominant 0Hz bin that masks all
  // fault frequencies. Linear detrend removes slow drift (gravity offset in g-unit data).
  const seg = signal.slice(0, N);
  const dcMean = seg.reduce((a, b) => a + b, 0) / N;
  // Linear detrend: fit y = a + b*i, subtract trend
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < N; i++) { sx += i; sy += seg[i]; sxy += i * seg[i]; sxx += i * i; }
  const denom = N * sxx - sx * sx;
  const slope  = denom !== 0 ? (N * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / N;
  const detrended = seg.map((v, i) => v - (intercept + slope * i));
  const w = detrended.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))));
  function fft(re,im){const n=re.length;if(n<=1)return;const ee=[],eo=[],ie=[],io=[];for(let i=0;i<n/2;i++){ee.push(re[2*i]);eo.push(re[2*i+1]);ie.push(im[2*i]);io.push(im[2*i+1]);}fft(ee,ie);fft(eo,io);for(let k=0;k<n/2;k++){const a=-2*Math.PI*k/n,c=Math.cos(a),s=Math.sin(a),tr=c*eo[k]-s*io[k],ti=c*io[k]+s*eo[k];re[k]=ee[k]+tr;im[k]=ie[k]+ti;re[k+n/2]=ee[k]-tr;im[k+n/2]=ie[k]-ti;}}
  const re=[...w],im=new Array(N).fill(0); fft(re,im);
  const freqs=[],mags=[];
  for(let k=0;k<N/2;k++){freqs.push(k*fs/N);mags.push(Math.sqrt(re[k]**2+im[k]**2)/(N/2));}
  const sRms = Math.sqrt(mags.reduce((s,m)=>s+m*m,0)/mags.length);
  return {freqs,mags,fs,N,sRms};
}

// == SHAFT DETECTION  -  harmonic comb search ==
function detectShaft(fft) {
  const {freqs,mags,sRms} = fft;
  const fMin=CONFIG.shaft_freq_search_min_hz, fMax=CONFIG.shaft_freq_search_max_hz, n=CONFIG.harmonic_comb_count, bw=0.08;
  function peak(fc){const lo=fc*(1-bw),hi=fc*(1+bw);let mx=0;for(let i=0;i<freqs.length;i++){if(freqs[i]>hi)break;if(freqs[i]>=lo&&mags[i]>mx)mx=mags[i];}return mx;}
  // Find global max in search range to set adaptive threshold
  let rangeMax=0;
  for(let i=0;i<freqs.length;i++){if(freqs[i]>=fMin&&freqs[i]<=fMax&&mags[i]>rangeMax)rangeMax=mags[i];}
  const threshold = rangeMax * 0.05; // 5% of range peak — much more sensitive
  const cands=[];
  for(let i=1;i<freqs.length-1;i++){const f=freqs[i];if(f<fMin||f>fMax)continue;if(mags[i]>mags[i-1]&&mags[i]>mags[i+1]&&mags[i]>threshold)cands.push(f);}
  if(!cands.length)return (fMin+fMax)/2;
  let best=cands[0],bestS=-1;
  for(const fc of cands){if(fc*n>fft.fs/2)continue;let s=0;for(let h=1;h<=n;h++)s+=peak(fc*h);s*=(fc>fMax*0.5?0.85:1.0);if(s>bestS){bestS=s;best=fc;}}
  return best;
}

// == DATA TYPE DETECTOR ==
// Inspects column headers to determine what kind of data was uploaded.
// Returns a set of available data types: 'vibration', 'mcsa', 'voltage', 'power', 'frequency'
function detectDataTypes(headers) {
  const available = new Set();
  const det = CONFIG.data_type_detection;
  const hl = headers.map(h => h.toLowerCase());
  Object.entries(det).forEach(([type, patterns]) => {
    if (hl.some(h => patterns.some(p => h.includes(p)))) available.add(type);
  });
  // Always assume vibration if any numeric data present  -  it's the default input
  if (available.size === 0) available.add('vibration');
  return available;
}

// Returns a human-readable banner message about what data was detected
function getDataTypeBanner(dataTypes) {
  const has = t => dataTypes.has(t);
  if (has('mcsa') && has('vibration')) return { type:'combined', msg:'Vibration + MCSA data detected. Full mechanical and electrical fault analysis available.' };
  if (has('power') && has('vibration')) return { type:'combined', msg:'Vibration + Power monitoring data detected. Mechanical and process fault analysis available.' };
  if (has('mcsa')) return { type:'mcsa', msg:'MCSA / electrical data detected. Electrical fault analysis available. Vibration-based faults require acceleration or velocity data.' };
  if (has('power')) return { type:'power', msg:'Power monitoring data detected. Process fault analysis available.' };
  return { type:'vibration', msg:'Vibration data detected. Mechanical and bearing fault analysis will run. Electrical and process fault categories require MCSA or power meter data  -  not shown.' };
}

// == HEALTH INDEX ENGINE ==
// Physics-based 0-100 score derived from fault classification output + signal metrics.
// RULE: health status is fault-driven, not RMS-driven.
// Every penalty is ISO-referenced. Fault evidence from classifyFaults() feeds
// directly into the score — the engine reacts to what it found, not preset thresholds.
// ISO 10816-3, ISO 13373-2:2016, ISO 281:2007, ISO 13379-1:2012

function calcHealthIndex(rms, kurt, cf, zoneLabel, topBearingPct, devSigma, classRow) {
  let score = 100;
  const breakdown = [];

  // 1. ISO Zone penalty — ISO 10816-3:2009 §5.1-5.4
  // RMS velocity reflects vibration power. Zone boundaries are empirically established.
  const zonePenalties = { 'A': 0, 'B': 12, 'C': 35, 'D': 65 };
  let zonePenalty = zonePenalties[zoneLabel] || 0;
  if (zoneLabel === 'B') {
    const pos = Math.min(1, Math.max(0, (rms - 2.3) / (7.1 - 2.3)));
    zonePenalty = Math.round(12 + pos * 23);
  }
  score -= zonePenalty;
  breakdown.push({
    label: 'Vibration severity', penalty: zonePenalty,
    value: rms.toFixed(3) + ' mm/s → Zone ' + zoneLabel,
    iso: 'ISO 10816-3:2009 §5.1–5.4',
    physics: 'RMS velocity proportional to vibration power (W/kg)'
  });

  // 2. Kurtosis penalty — ISO 13373-2:2016 §8.3
  // Excess kurtosis indicates impulsive bearing impacts.
  // Power law (exponent 1.5) reflects Hertz contact damage mechanics.
  const kurtExcess = Math.max(0, kurt - 3.0);
  const kurtPenalty = Math.min(30, Math.round(8 * Math.pow(kurtExcess, 1.5)));
  score -= kurtPenalty;
  breakdown.push({
    label: 'Impulsive content (Kurtosis)', penalty: kurtPenalty,
    value: 'K=' + kurt.toFixed(2) + ' (excess ' + kurtExcess.toFixed(2) + ' above Gaussian 3.0)',
    iso: 'ISO 13373-2:2016 §8.3',
    physics: '8 × (K−3)^1.5 — Hertz contact damage mechanics'
  });

  // 3. Crest Factor penalty — ISO 13373-2:2016 §8.2
  // CF = Peak/RMS. Healthy: 2.5–3.5. Reflects shock content.
  let cfPenalty = 0;
  if      (cf > 8)   cfPenalty = 20;
  else if (cf > 5)   cfPenalty = Math.round(10 + (cf-5)/3*10);
  else if (cf > 3.5) cfPenalty = Math.round((cf-3.5)/1.5*10);
  score -= cfPenalty;
  breakdown.push({
    label: 'Shock content (Crest Factor)', penalty: cfPenalty,
    value: 'CF=' + cf.toFixed(2) + ' (healthy 2.5–3.5)',
    iso: 'ISO 13373-2:2016 §8.2',
    physics: 'CF = Peak/RMS — transient shock vs average energy ratio'
  });

  // 4. Bearing fault penalty — ISO 13379-1:2012 Annex A §A.3 + ISO 281:2007
  // Directly driven by fault classification output (topBearingPct).
  // This is the key coupling: the health score reacts to what classifyFaults() found.
  // ISO 281 L10 life equation: fatigue life ∝ (C/P)^3 — small load increase = large life reduction.
  let bearingPenalty = 0;
  if      (topBearingPct >= 80) bearingPenalty = 35;
  else if (topBearingPct >= 60) bearingPenalty = Math.round(15 + (topBearingPct-60)/20*20);
  else if (topBearingPct >= 40) bearingPenalty = Math.round(5  + (topBearingPct-40)/20*10);
  else if (topBearingPct >= 20) bearingPenalty = Math.round((topBearingPct-20)/20*5);
  score -= bearingPenalty;
  breakdown.push({
    label: 'Bearing fault evidence', penalty: bearingPenalty,
    value: faultIndicatorLabel(topBearingPct) + ' (' + topBearingPct + ')' + (topBearingPct >= 60 ? ' — above 6dB detection threshold' : ''),
    iso: 'ISO 13379-1:2012 Annex A §A.3 | ISO 281:2007',
    physics: 'BER detection + ISO 281 L10 life: fatigue ∝ (C/P)^3'
  });

  // 5. Baseline deviation penalty — ISO 13373-2:2016 §8.1
  // SPC Western Electric 3-sigma rule.
  let devPenalty = 0;
  if      (devSigma > 3.5) devPenalty = 20;
  else if (devSigma > 3.0) devPenalty = 15;
  else if (devSigma > 2.0) devPenalty = 10;
  else if (devSigma > 1.5) devPenalty = 5;
  score -= devPenalty;
  breakdown.push({
    label: 'Baseline deviation', penalty: devPenalty,
    value: devSigma.toFixed(2) + 'σ from baseline',
    iso: 'ISO 13373-2:2016 §8.1',
    physics: 'SPC Western Electric rule — 3σ = 99.7% confidence of real change'
  });

  const finalScore = Math.max(5, Math.min(100, score));
  return {
    score: finalScore,
    breakdown,
    label: finalScore >= 85 ? 'Good' : finalScore >= 65 ? 'Monitor' : finalScore >= 40 ? 'Caution' : 'Critical',
    color: finalScore >= 85 ? 'var(--green)' : finalScore >= 65 ? '#1a6bbf' : finalScore >= 40 ? 'var(--yellow)' : 'var(--red)'
  };
}

// == FAULT-ZONE OVERRIDE ENGINE ==
// ISO 13379-1:2012 §5.4 — frequency-domain fault findings take precedence
// over RMS-based zone when fault confidence exceeds threshold.
// Ensures health status reflects what the fault engine detected, not just RMS level.
function applyFaultOverride(zoneRow, rulR, faults, kurt, cf, classRow) {
  const result = {
    zoneRow: { ...zoneRow }, rulR: { ...rulR },
    overrideActive: false, overrideReason: null, overrideISO: null
  };
  const unlockedFaults = faults.filter(f => !f.locked);
  const topFault = unlockedFaults[0];
  const topPct  = topFault?.pct || 0;
  const topName = topFault?.name || '';
  const isBearing   = topFault?.category === 'bearing';

  // Rule 1: Bearing fault overrides RMS zone — ISO 13379-1:2012 §5.4
  if (isBearing && topPct >= 60) {
    result.overrideActive = true;
    if (zoneRow.zone_label === 'A' || (zoneRow.zone_label === 'B' && topPct >= 80)) {
      result.zoneRow = {
        ...zoneRow,
        zone_label: topPct >= 80 ? 'C' : 'B',
        action_required: topPct >= 80
          ? 'BEARING FAULT DETECTED — Corrective maintenance required. RMS underestimates severity for impulsive faults.'
          : 'BEARING FAULT DETECTED — Schedule inspection. Frequency analysis indicates bearing defect despite low RMS.'
      };
      const rulFactor = topPct >= 80 ? 0.4 : 0.6;
      result.rulR = { ...rulR, days: Math.round(rulR.days * rulFactor), ci: Math.round(rulR.ci * rulFactor), overridden: true };
    }
    result.overrideReason = 'Bearing fault indicator: ' + faultIndicatorLabel(topPct) + ' (' + topName + ') — frequency analysis overrides RMS zone per ISO 13379-1:2012 §5.4';
    result.overrideISO = 'ISO 13379-1:2012 §5.4';
  }

  // Rule 2: Elevated kurtosis override — ISO 13373-2:2016 §8.3
  if (kurt >= 4.0 && !result.overrideActive) {
    result.overrideActive = true;
    result.overrideReason = 'Elevated kurtosis (' + kurt.toFixed(2) + ') indicates impulsive fault — ISO 13373-2:2016 §8.3';
    result.overrideISO = 'ISO 13373-2:2016 §8.3';
    if (zoneRow.zone_label === 'A') {
      result.zoneRow = { ...zoneRow, action_required: 'Elevated kurtosis detected. Impulsive fault activity present despite low RMS. Inspect bearing condition.' };
    }
  }

  return result;
}

// == FAULT CLASSIFICATION ==
// == FAULT CLASSIFICATION — v2 ==
// ─────────────────────────────────────────────────────────────────────────────
// SCORING METHOD: Dual-band Envelope BER (Band Energy Ratio)
//
// RULE 1 — No hardcoding:
//   All frequency multipliers from CONFIG.fault_frequency_rules.
//   When a bearing is selected in the wizard, exact multipliers come from the
//   bearing library via machineParams.bearingMultipliers. Falls back to CONFIG
//   rule defaults when no bearing is selected.
//   Demodulation bands defined in CONFIG (envelope_bands) — not hardcoded.
//   Shaft frequency from machineParams.shaftHz (wizard RPM input or mat file),
//   falling back to detectShaft() when not supplied.
//
// RULE 2 — ISO references:
//   Envelope analysis:        ISO 13373-2:2016 §7.5
//   BER scoring:              ISO 13379-1:2012 Annex A
//   Mechanical confirmation:  ISO 13379-1:2012 §5.2–5.4
//   Sideband confirmation:    ISO 13379-1:2012 §A.3
//   Signal quality factor:    ISO 13373-2:2016 §7.2
//   CF / kurtosis bonuses:    ISO 13373-2:2016 §7.3–7.4
//
// RULE 3 — Format agnostic:
//   BER = fault band peak / background band mean — dimensionless ratio.
//   Works identically on g, mm/s, m/s², in/s inputs.
//   Logarithmic BER→score mapping handles the full dynamic range from
//   low-amplitude velocity data to high-amplitude acceleration data.
//
// machineParams = {
//   shaftHz:            number  — shaft frequency Hz (wizard RPM ÷ 60)
//   bearingMultipliers: object  — { bpfo, bpfi, bsf, ftf } from bearing
//                                 library, or null for CONFIG defaults
//   loadZonePosition:   string  — 'centered'|'orthogonal'|'opposite'
//                                 default: 'centered' (ISO 13379-1:2012 §A.3)
// }
// ─────────────────────────────────────────────────────────────────────────────

function classifyFaults(fft, cf, kurt, dataTypes, machineParams) {
  const { freqs, mags, sRms } = fft;

  // -- Shaft frequency: from wizard/mat file → detectShaft() fallback --
  const shaft = (machineParams && machineParams.shaftHz > 0)
    ? machineParams.shaftHz
    : detectShaft(fft);

  // -- Bearing multipliers: bearing library → CONFIG rule defaults --
  // ISO 13379-1:2012 Annex A — exact geometry multipliers when known
  const bm = (machineParams && machineParams.bearingMultipliers) || null;
  function getFreqMult(ruleId, configMult) {
    if (!bm) return configMult;
    return ({ r_bpfo: bm.bpfo, r_bpfi: bm.bpfi, r_bsf: bm.bsf, r_ftf: bm.ftf })[ruleId]
      || configMult;
  }

  // -- Load zone: default centered (most common, conservative) --
  // ISO 13379-1:2012 §A.3 — OR defect in load zone shows shaft modulation
  const loadZone = (machineParams && machineParams.loadZonePosition) || 'centered';

  // -- Demodulation bands from CONFIG — not hardcoded --
  // Race band (BPFO, BPFI): high-frequency resonance excitation
  // Roll band (BSF, FTF):   mid-frequency cage/ball modulation
  // ISO 13373-2:2016 §7.5 — select band to maximise SNR at fault frequency
  const raceBand = CONFIG.envelope_bands ? CONFIG.envelope_bands.race : { lo: 3000, hi: 4500 };
  const rollBand = CONFIG.envelope_bands ? CONFIG.envelope_bands.roll : { lo: 700,  hi: 1800 };

  // -- Global signal quality factor — ISO 13373-2:2016 §7.2 --
  // SNR > 8: strong tonal signal (factor=1.0); SNR < 2: noise-dominated (factor=0.1)
  let specPeak = 0;
  for (let i = 0; i < mags.length; i++) { if (mags[i] > specPeak) specPeak = mags[i]; }
  const snr = specPeak / (sRms || 1);
  const snrFactor = Math.min(1.0, Math.max(0.1, (snr - 2) / 6));

  // -- CF and kurtosis bonuses — ISO 13373-2:2016 §7.3–7.4 --
  const cfB = getCFBonus(cf);
  const kB  = getKBonus(kurt);

  // ── ENVELOPE COMPUTATION ─────────────────────────────────────────────────
  // Bandpass filter → Hilbert envelope → FFT of envelope
  // Demodulates resonance-band amplitude modulation caused by bearing impacts.
  // ISO 13373-2:2016 §7.5 — envelope analysis for rolling element bearing faults.
  function computeEnvelopeFFT(bpLo, bpHi) {
    const N    = fft.N;
    const nyq  = fft.fs / 2;
    const bpLo_n = bpLo / nyq;
    const bpHi_n = bpHi / nyq;

    // 4th-order Butterworth bandpass coefficients (bilinear transform)
    // Implemented inline — no CDN dependency, runs in browser.
    const signal = fft._rawSignal;   // injected at pipeline stage — see runPipeline()
    if (!signal || signal.length < 64) return null;

    const filtered = butterworthBandpass(signal, bpLo_n, bpHi_n, 4);
    if (!filtered) return null;

    // Hilbert transform via FFT: analytic signal magnitude = envelope
    const envelope = hilbertEnvelope(filtered);

    // Remove DC from envelope
    let envMean = 0;
    for (let i = 0; i < envelope.length; i++) envMean += envelope[i];
    envMean /= envelope.length;
    const envCentered = envelope.map(v => v - envMean);

    return computeFFT(envCentered, fft.fs);
  }

  // Butterworth bandpass — bilinear transform, 4th order
  // Poles computed analytically — no iterative solver needed.
  function butterworthBandpass(signal, wLo, wHi, order) {
    try {
      // Pre-warp frequencies
      const fLo = 2 * Math.tan(Math.PI * wLo / 2);
      const fHi = 2 * Math.tan(Math.PI * wHi / 2);
      const bw  = fHi - fLo;
      const w0  = Math.sqrt(fLo * fHi);

      // 2nd-order Butterworth sections (cascade of biquads)
      // For 4th-order bandpass: 2 biquad sections
      const sections = [];
      for (let k = 0; k < order / 2; k++) {
        const theta = Math.PI * (2 * k + 1) / (2 * order);
        const sk    = { re: -Math.sin(theta), im: Math.cos(theta) };  // analog LP pole
        // LP→BP transformation: each LP pole becomes 2 BP poles
        // Bilinear transform each BP pole to digital domain
        // Simplified: use direct-form II biquad with pre-computed coefficients
        const alpha = sk.re * bw / 2;
        const beta  = Math.sqrt(w0 * w0 + sk.re * sk.re * bw * bw / 4);
        const p1_re = alpha, p1_im =  Math.sqrt(Math.max(0, beta * beta - alpha * alpha));
        const p2_re = alpha, p2_im = -Math.sqrt(Math.max(0, beta * beta - alpha * alpha));

        // Bilinear: z = (1+s)/(1-s) → s = (z-1)/(z+1)
        const bd1 = biquadFromPole(p1_re, p1_im, true);
        const bd2 = biquadFromPole(p2_re, p2_im, false);
        if (bd1) sections.push(bd1);
        if (bd2) sections.push(bd2);
      }

      if (!sections.length) return signal;

      // Apply biquad cascade
      let out = signal.slice();
      for (const s of sections) {
        out = applyBiquad(out, s.b, s.a);
      }
      return out;
    } catch (e) {
      return signal;   // fallback: return unfiltered on error
    }
  }

  function biquadFromPole(pr, pi, bandpass) {
    // Bilinear transform of analog pole (pr ± j*pi) to digital biquad
    const d  = (1 - pr) * (1 - pr) + pi * pi;
    if (d < 1e-12) return null;
    const zr = (1 - pr * pr - pi * pi) / d;
    const zi =  2 * pi / d;
    // Bandpass biquad: b = [1, 0, -1], a built from poles
    const a1 = -2 * zr;
    const a2 = zr * zr + zi * zi;
    return bandpass
      ? { b: [1, 0, -1], a: [1, a1, a2] }
      : { b: [1, 0, -1], a: [1, a1, a2] };
  }

  function applyBiquad(x, b, a) {
    const y = new Array(x.length).fill(0);
    let w1 = 0, w2 = 0;
    for (let n = 0; n < x.length; n++) {
      const w0n = x[n] - a[1] * w1 - a[2] * w2;
      y[n] = b[0] * w0n + (b[1] || 0) * w1 + (b[2] || 0) * w2;
      w2 = w1; w1 = w0n;
    }
    return y;
  }

  function hilbertEnvelope(x) {
    // Hilbert transform via FFT: set negative frequencies to zero,
    // double positive frequencies, IFFT → analytic signal magnitude
    const N2 = Math.pow(2, Math.floor(Math.log2(x.length)));
    const re = x.slice(0, N2);
    const im = new Array(N2).fill(0);
    fftInPlace(re, im);
    // One-sided spectrum: double positives, zero negatives
    for (let k = 1; k < N2 / 2; k++) { re[k] *= 2; im[k] *= 2; }
    for (let k = N2 / 2 + 1; k < N2; k++) { re[k] = 0; im[k] = 0; }
    ifftInPlace(re, im);
    return re.map((r, i) => Math.sqrt(r * r + im[i] * im[i]));
  }

  function fftInPlace(re, im) {
    const n = re.length;
    if (n <= 1) return;
    const ee = [], eo = [], ie = [], io = [];
    for (let i = 0; i < n / 2; i++) {
      ee.push(re[2 * i]); eo.push(re[2 * i + 1]);
      ie.push(im[2 * i]); io.push(im[2 * i + 1]);
    }
    fftInPlace(ee, ie); fftInPlace(eo, io);
    for (let k = 0; k < n / 2; k++) {
      const a = -2 * Math.PI * k / n;
      const c = Math.cos(a), s = Math.sin(a);
      const tr = c * eo[k] - s * io[k], ti = c * io[k] + s * eo[k];
      re[k] = ee[k] + tr; im[k] = ie[k] + ti;
      re[k + n / 2] = ee[k] - tr; im[k + n / 2] = ie[k] - ti;
    }
  }

  function ifftInPlace(re, im) {
    // IFFT = conjugate → FFT → conjugate → scale
    for (let i = 0; i < im.length; i++) im[i] = -im[i];
    fftInPlace(re, im);
    const n = re.length;
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
  }

  // -- Compute envelope spectra for both bands --
  const envRace = computeEnvelopeFFT(raceBand.lo, raceBand.hi);
  const envRoll = computeEnvelopeFFT(rollBand.lo, rollBand.hi);

  // ── SPECTRAL HELPERS ─────────────────────────────────────────────────────

  // Peak magnitude in band fc*(1±bw) — ISO 13379-1:2012 Annex A
  function bandPeak(fArr, mArr, fc, bw) {
    const lo = fc * (1 - bw), hi = fc * (1 + bw);
    let mx = 0;
    for (let i = 0; i < fArr.length; i++) {
      if (fArr[i] > hi) break;
      if (fArr[i] >= lo && mArr[i] > mx) mx = mArr[i];
    }
    return mx;
  }

  // Band Energy Ratio — ISO 13379-1:2012 Annex A
  // BER = fault band peak / mean of nBg adjacent background bands each side
  // Dimensionless — unit-agnostic across g, mm/s, m/s², in/s
  function ber(fArr, mArr, fc, bw, nBg) {
    const n       = nBg || 3;
    const spacing = fc * bw * 2.5;
    const nyq     = fft.fs / 2;
    const bgVals  = [];
    for (let k = 1; k <= n; k++) {
      for (const s of [-1, 1]) {
        const fcBg = fc + s * k * spacing;
        if (fcBg > 0 && fcBg < nyq) bgVals.push(bandPeak(fArr, mArr, fcBg, bw));
      }
    }
    const bgMean = bgVals.length ? bgVals.reduce((a, b) => a + b, 0) / bgVals.length : 1e-9;
    return bandPeak(fArr, mArr, fc, bw) / (bgMean || 1e-9);
  }

  // Multi-harmonic BER average — tonal faults show elevation at multiple harmonics
  function berAvg(fArr, mArr, fc, bw, nHarm) {
    const nyq = fft.fs / 2;
    const vals = [];
    for (let h = 1; h <= nHarm; h++) {
      const fh = fc * h;
      if (fh > nyq) break;
      vals.push(ber(fArr, mArr, fh, bw, 3));
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  // Sideband count — ISO 13379-1:2012 §A.3
  // Counts amplitude modulation sidebands at center ± k*spacing
  function sidebandCount(fArr, mArr, centerHz, spacingHz, bw, nSide) {
    const nyq = fft.fs / 2;
    let found = 0;
    for (let k = 1; k <= nSide; k++) {
      for (const s of [-1, 1]) {
        const f = centerHz + s * k * spacingHz;
        if (f > 0 && f < nyq && bandPeak(fArr, mArr, f, bw) > 0) found++;
      }
    }
    return found;
  }

  // ── BER → SCORE MAPPING ───────────────────────────────────────────────────
  // Logarithmic mapping — ISO 13373-2:2016 §7.5
  // BER=1.0: no fault signal above background → score=0
  // BER=2.0: 2× noise floor → score≈24% of cw-weighted max
  // BER=5.0: 5× noise floor → score≈53% of cw-weighted max
  // BER=20+: strong fault → score=100% of cw-weighted max
  // log(BER)/log(20) maps [1,∞] → [0,1] with natural non-linear compression
  // that reflects the exponential growth of bearing fault energy with defect size.
  function berToScore(berVal, cw) {
    if (berVal <= 1.0) return 0;
    const normalised = Math.min(1.0, Math.log(berVal) / Math.log(20));
    return Math.round(normalised * 100 * cw * snrFactor);
  }

  // ── PRE-COMPUTE BEARING BERs FOR MECHANICAL SUPPRESSION ──────────────────
  // ISO 13379-1:2012 §5.2: when bearing envelope evidence is present,
  // shaft-synchronous peaks (1x, 2x) may result from bearing load modulation
  // rather than true mechanical faults. Cap mechanical scores accordingly.
  const bpfoHz = shaft * getFreqMult('r_bpfo', CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_bpfo')?.freq_multiplier || 3.5);
  const bpfiHz = shaft * getFreqMult('r_bpfi', CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_bpfi')?.freq_multiplier || 5.5);
  const bsfHz  = shaft * getFreqMult('r_bsf',  CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_bsf')?.freq_multiplier  || 2.4);
  const ftfHz  = shaft * getFreqMult('r_ftf',  CONFIG.fault_frequency_rules.find(r => r.rule_id === 'r_ftf')?.freq_multiplier  || 0.4);

  const maxRaceBer = envRace
    ? Math.max(berAvg(envRace.freqs, envRace.mags, bpfoHz, 0.15, 3),
               berAvg(envRace.freqs, envRace.mags, bpfiHz, 0.15, 3))
    : 0;
  const bsfBerRoll = envRoll ? berAvg(envRoll.freqs, envRoll.mags, bsfHz, 0.15, 3) : 0;
  const bsfBerRace = envRace ? berAvg(envRace.freqs, envRace.mags, bsfHz, 0.15, 3) : 0;
  const bsfBer     = Math.max(bsfBerRoll, bsfBerRace);
  const ftfBer1 = envRoll ? ber(envRoll.freqs, envRoll.mags, ftfHz, 0.20, 3) : 0;
  const maxRollBer = Math.max(bsfBer, ftfBer1);
  const maxBearingBer = Math.max(maxRaceBer, maxRollBer);

  // Mechanical suppression cap — ISO 13379-1:2012 §5.2
  // When bearing envelope BER exceeds threshold, mechanical fault scores capped at 10%
  // Uses CONFIG value (currently 1.3) — tuned against CWRU dataset
  const mechCap = maxBearingBer > CONFIG.bearing_ber_threshold ? 10 : 95;

  // ── MAIN RULE LOOP ────────────────────────────────────────────────────────
  return CONFIG.fault_frequency_rules.map(rule => {
    const req = rule.requires;

    // -- Data availability gate — locked if required data type absent --
    const hasRequired =
      (req === 'vibration' && dataTypes.has('vibration')) ||
      (req === 'mcsa'      && (dataTypes.has('mcsa') || dataTypes.has('voltage'))) ||
      (req === 'power'     && dataTypes.has('power'));

    if (!hasRequired) {
      return {
        name: rule.fault_type, category: rule.category,
        pct: 0, locked: true,
        lock_reason: rule.detection_note,
        iso_reference: rule.iso_reference,
        freq_hz: null, harmonics_used: 0
      };
    }

    const isVibDerived = (rule.category === 'electrical' && req === 'vibration');

    if (!rule.freq_multiplier) {
      return { name: rule.fault_type, category: rule.category, pct: 2, locked: false,
               iso_reference: rule.iso_reference, freq_hz: null, harmonics_used: 0 };
    }

    const fm  = getFreqMult(rule.rule_id, rule.freq_multiplier);
    const fc  = shaft * fm;
    const nyq = fft.fs / 2;

    if (fc > nyq) {
      return { name: rule.fault_type, category: rule.category, pct: 2, locked: false,
               iso_reference: rule.iso_reference, freq_hz: fc, harmonics_used: 0 };
    }

    let sc = 2, h2 = 0;

    // ── BEARING — OUTER RACE (BPFO) ───────────────────────────────────────
    // ISO 13379-1:2012 Annex A §A.3 — race band envelope BER
    // Load zone boost: BPFO ± shaft sidebands when OR in load zone
    if (rule.rule_id === 'r_bpfo') {
      const eArr = envRace;
      const eBer = eArr ? berAvg(eArr.freqs, eArr.mags, fc, rule.bandwidth_pct, rule.harmonic_count) : 0;
      h2 = rule.harmonic_count;
      sc = berToScore(eBer, rule.confidence_weight);
      sc += Math.round((cfB + kB) * rule.confidence_weight * snrFactor);
      // Load zone shaft modulation — ISO 13379-1:2012 §A.3
      if ((loadZone === 'centered' || loadZone === 'orthogonal') && eBer > 1.3 && eArr) {
        const sb = sidebandCount(eArr.freqs, eArr.mags, fc, shaft, rule.bandwidth_pct, 2);
        if (sb >= 2) sc = Math.round(sc * 1.3);
      }

    // ── BEARING — INNER RACE (BPFI) ───────────────────────────────────────
    // ISO 13379-1:2012 Annex A §A.3 — race band envelope BER
    } else if (rule.rule_id === 'r_bpfi') {
      const eArr = envRace;
      const eBer = eArr ? berAvg(eArr.freqs, eArr.mags, fc, rule.bandwidth_pct, rule.harmonic_count) : 0;
      h2 = rule.harmonic_count;
      sc = berToScore(eBer, rule.confidence_weight);
      sc += Math.round((cfB + kB) * rule.confidence_weight * snrFactor);

    // ── BEARING — ROLLING ELEMENT (BSF) ──────────────────────────────────
    // ISO 13379-1:2012 Annex A §A.3 — roll band envelope BER
    // FTF cage modulation: when FTF BER elevated, use as confirmation
    // and take max(BSF, FTF) BER as effective score — handles case where
    // ball defect excites cage motion before BSF frequency dominates.
    } else if (rule.rule_id === 'r_bsf') {
      // 4-path BSF detection: ball impacts excite race-band resonance same as race faults
      const nHarm = Math.max(rule.harmonic_count, 3);
      const bsfRace = envRace ? berAvg(envRace.freqs, envRace.mags, fc, rule.bandwidth_pct, nHarm) : 0;
      const bsfRoll = envRoll ? berAvg(envRoll.freqs, envRoll.mags, fc, rule.bandwidth_pct, nHarm) : 0;
      const rollHighBand = CONFIG.envelope_bands ? CONFIG.envelope_bands.rollHigh : { lo: 1800, hi: 5000 };
      const envRollHigh  = computeEnvelopeFFT(rollHighBand.lo, rollHighBand.hi);
      const bsfHigh = envRollHigh ? berAvg(envRollHigh.freqs, envRollHigh.mags, fc, rule.bandwidth_pct, nHarm) : 0;
      const bsfDirect = berAvg(freqs, mags, fc, rule.bandwidth_pct, nHarm);
      const ftfRoll = envRoll ? ber(envRoll.freqs, envRoll.mags, ftfHz, 0.20, 3) : 0;
      const ftfRace = envRace ? ber(envRace.freqs, envRace.mags, ftfHz, 0.20, 3) : 0;
      const ftfE    = Math.max(ftfRoll, ftfRace);
      h2 = nHarm;
      const bestBsfBer = Math.max(bsfRace, bsfRoll, bsfHigh, bsfDirect * 0.7);
      const ftfConfirmed = ftfE > 1.1;
      const effectiveBer = ftfConfirmed ? Math.max(bestBsfBer, ftfE) : bestBsfBer;
      sc = berToScore(effectiveBer, rule.confidence_weight);
      sc += Math.round((cfB + kB) * rule.confidence_weight * snrFactor);
      if (ftfConfirmed) sc = Math.round(sc * 1.25);


    // ── BEARING — CAGE DEFECT (FTF) ──────────────────────────────────────
    // ISO 13379-1:2012 Annex A §A.3 — roll band envelope BER
    } else if (rule.rule_id === 'r_ftf') {
      const eArr = envRoll;
      const eBer = eArr ? berAvg(eArr.freqs, eArr.mags, fc, rule.bandwidth_pct, rule.harmonic_count) : 0;
      h2 = rule.harmonic_count;
      sc = berToScore(eBer, rule.confidence_weight);
      sc += Math.round((cfB + kB) * rule.confidence_weight * snrFactor);

    // ── LOOSE FOUNDATION ─────────────────────────────────────────────────
    // ISO 13379-1:2012 §5.4 — raw FFT: sub-harmonic at 0.5× shaft required
    } else if (rule.rule_id === 'r_loose_found') {
      const subBer = ber(freqs, mags, shaft * 0.5, rule.bandwidth_pct, 3);
      let total = 0; h2 = 0;
      for (let h = 1; h <= rule.harmonic_count; h++) {
        const fh = fc * h; if (fh > nyq) break;
        total += ber(freqs, mags, fh, rule.bandwidth_pct, 3); h2++;
      }
      const avgBer = h2 ? total / h2 : 0;
      sc = berToScore(avgBer, rule.confidence_weight);
      // Sub-harmonic required — ISO 13379-1:2012 §5.4
      if (subBer < 2.0) sc = Math.min(sc, 18);
      if (avgBer < 2.5) sc = Math.min(sc, 20);
      sc = Math.min(sc, mechCap);

    // ── MECHANICAL UNBALANCE ─────────────────────────────────────────────
    // ISO 13379-1:2012 §5.2 — raw FFT: dominant 1× shaft
    } else if (rule.rule_id === 'r_imbal') {
      const b = ber(freqs, mags, fc, rule.bandwidth_pct, 3);
      h2 = 1;
      sc = berToScore(b, rule.confidence_weight);
      if (b < 2.5) sc = Math.min(sc, 20);
      sc = Math.min(sc, mechCap);

    // ── SHAFT MISALIGNMENT ───────────────────────────────────────────────
    // ISO 13379-1:2012 §5.3 — raw FFT: elevated 2× AND 3× required
    } else if (rule.rule_id === 'r_misalign') {
      const ber2x = ber(freqs, mags, fc,       rule.bandwidth_pct, 3);
      const ber3x = ber(freqs, mags, fc * 1.5, rule.bandwidth_pct, 3);  // fc=2×, 1.5×fc=3×
      h2 = 2;
      const avgBer = (ber2x + ber3x) / 2;
      sc = berToScore(avgBer, rule.confidence_weight);
      // 3× confirmation required — ISO 13379-1:2012 §5.3
      if (ber3x < 1.5) sc = Math.min(sc, 20);
      if (avgBer < 2.5) sc = Math.min(sc, 20);
      sc = Math.min(sc, mechCap);

    // ── VIBRATION-DERIVED ELECTRICAL INDICATORS ──────────────────────────
    // IEC 60034-14:2003 — indirect indicator, lower cap
    } else {
      let total = 0; h2 = 0;
      for (let h = 1; h <= rule.harmonic_count; h++) {
        const fh = fc * h; if (fh > nyq) break;
        total += ber(freqs, mags, fh, rule.bandwidth_pct, 3); h2++;
      }
      const avgBer = h2 ? total / h2 : 0;
      sc = berToScore(avgBer, rule.confidence_weight);
    }

    // IEC 60034-14: vibration-derived electrical faults are indirect indicators only.
    // Cap at 19 (Low tier) — they should not outrank direct vibration mechanical/bearing findings.
    // Direct MCSA unlocks full scoring range.
    const cap = isVibDerived ? 19 : (rule.category === 'mechanical' ? mechCap : 95);

    return {
      name:             rule.fault_type,
      category:         rule.category,
      pct:              Math.min(cap, Math.max(2, sc)),
      locked:           false,
      vibration_derived: isVibDerived || false,
      iso_reference:    rule.iso_reference,
      freq_hz:          fc,
      harmonics_used:   h2,
      detection_note:   isVibDerived ? rule.detection_note : null
    };

  }).sort((a, b) => {
    if (a.locked && !b.locked) return 1;
    if (!a.locked && b.locked) return -1;
    return b.pct - a.pct;
  });
}

// == UI HELPERS ==
function showProcessing(fn) {
  document.getElementById('upload-screen').style.display='none';
  document.getElementById('processing-screen').style.display='flex';
  document.getElementById('results-screen').style.display='none';
  document.getElementById('proc-filename').textContent=fn;
  for(let i=1;i<=6;i++){document.getElementById('stage-'+i).className='stage-item';document.getElementById('s'+i+'-st').textContent=' - ';}
}
function setNote(t){document.getElementById('proc-note').textContent=t;}
async function activateStage(n){
  await new Promise(r=>setTimeout(r,280));
  const el=document.getElementById('stage-'+n);
  el.className='stage-item active';
  el.querySelector('.s-num').innerHTML='<div class="spinner"></div>';
  document.getElementById('s'+n+'-st').textContent='Running...';
  await new Promise(r=>setTimeout(r,450+Math.random()*280));
}
function doneStage(n,msg){const el=document.getElementById('stage-'+n);el.className='stage-item done';el.querySelector('.s-num').textContent=n;document.getElementById('s'+n+'-st').textContent=msg;}

function resetApp(){
  pendingFile=null;pendingRaw=null;pendingMatBuffer=false;machineParams={};window.machineParams={};isBaselineUpload=false;
  const bt=document.getElementById('baseline-toggle'); if(bt) bt.classList.remove('active');
  const bcb=document.getElementById('baseline-checkbox'); if(bcb) bcb.checked=false;
  document.getElementById('fileInput').value='';
  document.getElementById('upload-screen').style.display='flex';
  document.getElementById('processing-screen').style.display='none';
  document.getElementById('results-screen').style.display='none';
  document.getElementById('step3-card').style.display='none';
  document.getElementById('drop-glyph').textContent='[folder]';
  document.getElementById('drop-title').textContent='Drop file here or click to browse';
  document.getElementById('drop-sub').textContent='Any column layout  -  auto-detected';
  document.getElementById('select-btn').textContent='^ Browse File';
  setStepDone('step1-num',false); setStepDone('step2-num',false);
  document.getElementById('reco-text').textContent='';
  document.getElementById('reco-text').classList.add('typing');
  document.getElementById('ew-banner').classList.remove('show');
  if(radarInst){radarInst.destroy();radarInst=null;}
  if(fftInst){fftInst.destroy();fftInst=null;}
  // Restore single-channel layout; clear multi-channel results
  const scr = document.getElementById('single-channel-results');
  if (scr) scr.style.display = '';
  const mcr = document.getElementById('multiChannelResults');
  if (mcr) mcr.innerHTML = '';
  const mcs = document.getElementById('multiChannelSuggestion');
  if (mcs) { mcs.style.display = 'none'; mcs.innerHTML = ''; }
  const hint = document.getElementById('asset-name-hint');
  if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
  if (window.MC) { window.MC.results = []; }
  // Clean up freemium overlays
  const wm = document.getElementById('ax-watermark');
  if (wm) wm.remove();
  const tb = document.getElementById('ax-trial-banner');
  if (tb) tb.remove();
}

// == RENDER ==

// == MANAGEMENT SUMMARY CARD ================================================
// Plain-English status card for non-engineering management audience.
// Combines Health Index + Fault Indicator + Zone + RUL into one clear signal.
function renderMgmtCard(d) {
  const card   = document.getElementById('mgmt-card');
  const icon   = document.getElementById('mgmt-icon');
  const status = document.getElementById('mgmt-status');
  const finding= document.getElementById('mgmt-finding');
  const pills  = document.getElementById('mgmt-pills');
  const rulEl  = document.getElementById('mgmt-rul');
  const rulSub = document.getElementById('mgmt-rul-sub');
  if (!card) return;

  card.style.display = 'flex';

  const hi    = d.healthIdx ? d.healthIdx.score : 80;
  const top   = d.faults.find(f => !f.locked && f.pct > 0);
  const topPct= top ? top.pct : 0;
  const zone  = d.zoneRow.zone_label;
  const rul   = d.rulR.days;
  const trend = d.trendRow.code;

  // ── Determine overall RAG status ─────────────────────────────────────────
  let rag, iconChar, statusText, findingText;

  // RAG logic — ZONE SETS THE FLOOR, FAULT CONFIDENCE SETS THE CEILING
  //
  // ISO 10816-3 zone is the primary safety gate — Zone D is ALWAYS red,
  // Zone C is always red, regardless of fault confidence level.
  // Fault confidence then determines the specific status text and urgency.
  //
  // Fault indicator tiers: Trace<8, Low<20, Indicative<40, Elevated<65, Strong<80, Critical>=80
  // GREEN  — Zone A AND health >= 65 AND fault Low or below
  // AMBER  — Zone B OR Indicative fault (20-39) in Zone A/B
  // RED    — Zone C or D (always) OR Elevated+ fault (>=40) OR health < 40

  if (zone === 'D') {
    // Zone D — always red, always urgent, ISO 10816-3 mandates shutdown
    rag = 'red';
    iconChar = '&#128308;';
    if (topPct >= 40) {
      statusText = 'Immediate Action Required';
      findingText = top
        ? plainFaultText(top) + ' Zone D — risk of machine damage. Immediate shutdown warranted.'
        : 'Zone D — dangerous vibration level. Immediate shutdown warranted per ISO 10816-3.';
    } else if (topPct >= 20) {
      statusText = 'Action Required';
      findingText = top
        ? plainFaultText(top) + ' Zone D confirmed. Condition is dangerous. Arrange inspection within 7 days.'
        : 'Zone D — dangerous vibration level. Arrange inspection within 7 days.';
    } else {
      statusText = 'Action Required';
      findingText = 'Zone D — dangerous vibration level. Risk of machine damage. Immediate shutdown warranted per ISO 10816-3:2009 S5.4.';
    }
  } else if (zone === 'C') {
    // Zone C — always red, schedule imminent maintenance
    rag = 'red';
    iconChar = '&#128308;';
    statusText = topPct >= 40 ? 'Immediate Action Required' : 'Action Required';
    findingText = top
      ? plainFaultText(top) + ' Condition is poor. Arrange inspection within ' + (rul < 30 ? '7' : '30') + ' days.'
      : 'Zone C — unsatisfactory vibration level. Schedule maintenance within 30 days per ISO 10816-3.';
  } else if (topPct >= 65) {
    // Strong or Critical fault in Zone A/B — escalate to red
    rag = 'red';
    iconChar = '&#128308;';
    statusText = 'Immediate Action Required';
    findingText = top
      ? plainFaultText(top) + ' Fault severity is high. Arrange inspection immediately — do not defer.'
      : 'Critical vibration fault detected. Immediate engineering review required.';
  } else if (topPct >= 40) {
    // Elevated fault in Zone A/B — red
    rag = 'red';
    iconChar = '&#128308;';
    statusText = 'Action Required';
    findingText = top
      ? plainFaultText(top) + ' Do not defer — arrange inspection within ' + (rul < 30 ? '7' : rul < 90 ? '30' : '90') + ' days.'
      : 'Elevated fault detected. Engineering review required.';
  } else if (topPct >= 20) {
    // Indicative fault in Zone A/B — amber
    rag = 'amber';
    iconChar = '&#128993;';
    statusText = 'Monitor Closely';
    findingText = top
      ? plainFaultText(top) + ' Fault signal is developing. Schedule inspection at next planned maintenance window.'
      : 'Developing fault signal detected. Increase monitoring frequency.';
  } else if (zone === 'A' && hi >= 65) {
    // No confirmed fault, Zone A, good health — green
    rag = 'green';
    iconChar = '&#128994;';
    statusText = 'Machine is Healthy';
    findingText = topPct >= 8
      ? 'No significant faults detected. A weak background signal was noted — no action required. Continue routine monitoring.'
      : 'No faults detected. Machine is operating normally. Continue routine monitoring schedule.';
  } else {
    // Zone B or degraded health, no significant fault
    rag = 'amber';
    iconChar = '&#128993;';
    statusText = 'Plan Maintenance';
    findingText = 'Vibration elevated above baseline. No confirmed fault — review at next maintenance window.';
  }

  // Final override — PRA trend with any amber upgrades to red
  if (trend === 'PRA' && rag === 'amber') {
    rag = 'red';
    iconChar = '&#128308;';
    statusText = 'Worsening — Act Soon';
    findingText = (top ? plainFaultText(top) : 'Vibration') + ' Condition is deteriorating rapidly. Schedule maintenance now.';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  card.className = 'mgmt-card ' + rag;
  icon.innerHTML = iconChar;
  status.textContent = statusText;
  finding.textContent = findingText;

  // Pills
  const pillDefs = [
    { label: 'Zone ' + zone, colour: zone === 'A' ? 'green' : zone === 'B' ? 'amber' : 'red' },
    { label: 'Health ' + hi + '/100', colour: hi >= 85 ? 'green' : hi >= 65 ? 'amber' : 'red' },
    { label: trend + ' trend', colour: trend === 'SWB' || trend === 'RGI' ? 'green' : trend === 'DDU' ? 'blue' : 'red' },
    top ? { label: faultIndicatorLabel(topPct) + ' fault signal', colour: topPct >= 40 ? 'red' : topPct >= 20 ? 'amber' : 'blue' } : null
  ].filter(Boolean);

  pills.innerHTML = pillDefs.map(p =>
    '<span class="mgmt-pill ' + p.colour + '">' + p.label + '</span>'
  ).join('');

  // RUL
  rulEl.textContent  = rul;
  rulSub.textContent = rul < 60 ? 'days — plan now' : rul < 180 ? 'days remaining' : 'days — good condition';
}

function plainFaultText(fault) {
  const n = fault.name;
  if (n.includes('Outer Race')) return 'Outer bearing surface wear detected.';
  if (n.includes('Inner Race')) return 'Inner bearing surface wear detected.';
  if (n.includes('Rolling Element')) return 'Bearing ball/roller wear detected.';
  if (n.includes('Cage'))        return 'Bearing cage wear detected.';
  if (n.includes('Imbalance'))   return 'Shaft imbalance detected — rotor may need balancing.';
  if (n.includes('Misalignment'))return 'Shaft misalignment detected — check coupling alignment.';
  if (n.includes('Looseness'))   return 'Mechanical looseness detected — check hold-down bolts.';
  return n + ' detected.';
}
// == END MANAGEMENT SUMMARY CARD ============================================

function renderResults(){
  const d=nvr;

  // Render Health Index — fault-driven score
  if (d.healthIdx) {
    const hi = d.healthIdx;
    const scoreEl = document.getElementById('health-score-num');
    const labelEl = document.getElementById('health-score-label');
    const barEl   = document.getElementById('health-bar-fill');
    const bdEl    = document.getElementById('health-breakdown');
    if (scoreEl) { scoreEl.textContent = hi.score; scoreEl.style.color = hi.color; }
    if (labelEl) { labelEl.textContent = hi.label; labelEl.style.color = hi.color; }
    if (barEl)   { barEl.style.width = hi.score + '%'; barEl.style.background = hi.color; }
    if (bdEl) {
      bdEl.innerHTML = hi.breakdown.map(b =>
        '<div class="hb-row">'
        + '<div class="hb-label">' + b.label + '</div>'
        + '<div class="hb-val">'   + b.value.split('(')[0].trim() + '</div>'
        + '<div class="hb-penalty' + (b.penalty === 0 ? ' zero' : '') + '">'
        + (b.penalty === 0 ? '[check]' : '-' + b.penalty) + '</div>'
        + '</div>'
      ).join('') +
      '<div style="display:flex;justify-content:space-between;padding:5px 0 2px;font-family:IBM Plex Mono,monospace;font-size:9px;color:var(--muted);">'
      + '<span>ISO 10816-3 · ISO 13373-2 · ISO 281 · ISO 13379-1</span>'
      + '<span style="color:' + hi.color + ';font-weight:700;">= ' + hi.score + ' / 100</span>'
      + '</div>';
    }
  }

  // Management summary card
  renderMgmtCard(d);

  // Override banner
  if (d.override && d.override.overrideActive) {
    const ob = document.getElementById('override-banner');
    const or_ = document.getElementById('override-reason');
    if (ob) ob.classList.add('show');
    if (or_) or_.textContent = d.override.overrideReason || '';
  }

  const zC={A:'var(--green)',B:'#1a6bbf',C:'var(--yellow)',D:'var(--red)'};
  document.getElementById('results-meta').innerHTML='File: <span>'+d.filename+'</span> &nbsp;.&nbsp; Class: <span>'+d.classRow.machine_type_desc+'</span>';
  const cfL=getCFLabel(parseFloat(d.cf)), kL=getKLabel(parseFloat(d.kurt));
  const tips = {
    'RMS Velocity': 'The overall vibration energy level  -  the most important single number. Higher = more vibration. Compared against ISO limits to determine your severity zone.',
    'Peak': 'The highest instantaneous vibration spike in the data. High peak with low RMS can indicate intermittent impact faults like bearing defects.',
    'Crest Factor': 'Peak divided by RMS. A healthy machine is typically 2.5 - 3.5. Above 5 = impacting faults likely (e.g. bearing damage). Think of it as a measure of how spiky the signal is.',
    'Kurtosis': 'A statistical measure of how sharp the vibration peaks are. Normal machinery = around 3. Above 6 = strong evidence of bearing impact faults. Your value here is key.',
    'Deviation': 'How far the current RMS is from the learned baseline  -  measured in standard deviations (sigma). Above 2sigma = Significant Deviation. Above 3.5sigma = Step-Change anomaly.',
    'Samples': 'Total data points analysed and the sampling rate. Higher sample rates capture higher-frequency faults like bearing defects more accurately.'
  };
  document.getElementById('nvr-grid').innerHTML=[
    {lb:'RMS Velocity',v:d.rms,u:d.cu,c:zC[d.zoneRow.zone_label]||'var(--text)'},
    {lb:'Peak',v:d.peak,u:d.cu,c:'var(--text)'},
    {lb:'Crest Factor',v:d.cf,u:cfL,c:cfL==='High'?'var(--orange)':cfL==='Elevated'?'var(--yellow)':'var(--text)'},
    {lb:'Kurtosis',v:d.kurt,u:kL,c:kL==='High impacting'?'var(--orange)':kL==='Elevated'?'var(--yellow)':'var(--text)'},
    {lb:'Deviation',v:d.devSc+'sigma',u:d.devRow.classification,c:['Significant Deviation','Step-Change'].includes(d.devRow.classification)?'var(--orange)':'var(--green)'},
    {lb:'Samples',v:d.n.toLocaleString(),u:(d.sr/1000).toFixed(1)+' kHz',c:'var(--accent)'},
  ].map(i=>'<div class="nvr-item"><div class="nvr-label"><span class="tip">'+i.lb+'<span class="tip-box">'+tips[i.lb]+'</span></span></div><div class="nvr-val" style="color:'+i.c+'">'+i.v+'</div><div class="nvr-unit">'+i.u+'</div></div>').join('');
  document.getElementById('nvr-clauses').innerHTML='<span class="clause">'+d.devRow.iso_reference+'</span><span class="clause">ISO 13373-1:2002 S5.2</span>';
  document.querySelectorAll('.zone-seg').forEach(el=>el.classList.toggle('current',el.dataset.z===d.zoneRow.zone_label));
  document.getElementById('zone-desc').textContent=d.zoneRow.action_required;
  document.getElementById('zone-iso-clause').textContent=d.zoneRow.iso_clause_ref;
  const rs=CONFIG.rul_bar_scale_days||Math.max(...CONFIG.rul_zone_base_days.map(r=>r.base_days));
  const rc=d.rulR.days<30?'var(--red)':d.rulR.days<90?'var(--orange)':d.rulR.days<180?'var(--yellow)':'var(--green)';
  document.getElementById('rul-num').textContent=d.rulR.days+'d';
  document.getElementById('rul-num').style.color=rc;
  document.getElementById('rul-ci').textContent='+/- '+d.rulR.ci+'d CI';
  document.getElementById('rul-scale-label').textContent=rs+'d';
  const pct=Math.min(95,Math.max(5,(d.rulR.days/rs)*100));
  const arr=document.getElementById('rul-arrow');arr.style.left=pct+'%';arr.style.background=rc;
  document.getElementById('rul-clauses').innerHTML='<span class="clause">'+d.rulR.iso_reference+'</span><span class="clause">ISO 55001:2014 S6.1</span>';
  const tC={SWB:'b-green',DDU:'b-blue',PRS:'b-yellow',PRA:'b-red',RGI:'b-green',SCO:'b-red'};
  document.getElementById('trend-badge').textContent=d.trendRow.code+'  -  '+d.trendRow.label;
  document.getElementById('trend-badge').className='badge '+(tC[d.trendRow.code]||'b-blue');
  if(d.earlyWarn){document.getElementById('ew-banner').classList.add('show');document.getElementById('ew-desc').textContent=d.devRow.classification+' ('+d.devSc+'sigma) + '+d.trendRow.code+' in Zone '+d.zoneRow.zone_label;document.getElementById('ew-clause').innerHTML='<span class="clause">'+CONFIG.early_warning_rule.iso_reference+'</span>';}
  const fp=['var(--red)','var(--orange)','var(--yellow)','var(--accent)','var(--green)','var(--muted)'];
  // Data type banner
  const bannerEl = document.getElementById('data-type-banner');
  if (bannerEl && d.dataBanner) {
    bannerEl.textContent = d.dataBanner.msg;
    bannerEl.style.display = 'flex';
    bannerEl.className = 'data-banner data-banner-'+d.dataBanner.type;
  }
  // A12: assumed-sample-rate banner — separate element/class from data-banner so it is
  // NOT caught by the print stylesheet's ".data-banner{display:none}" rule; this flag
  // must remain visible on printed/exported reports, not just on screen.
  const srBannerEl = document.getElementById('sample-rate-banner');
  if (srBannerEl) {
    if (d.sampleRateBanner) {
      srBannerEl.textContent = '⚠ ' + d.sampleRateBanner.msg;
      srBannerEl.style.display = 'flex';
    } else {
      srBannerEl.style.display = 'none';
    }
  }

  // Fault bars  -  unlocked faults in colour, locked faults greyed with lock icon
  const unlockedFaults = d.faults.filter(f => !f.locked);
  const lockedFaults   = d.faults.filter(f => f.locked);

  const unlockedHtml = unlockedFaults.slice(0, CONFIG.fault_display_limit).map((f,i) => {
    const col = fp[Math.min(i, fp.length-1)];
    const derivedTag = f.vibration_derived
      ? '<span style="font-size:8px;background:rgba(179,106,0,0.12);color:var(--yellow);border-radius:3px;padding:1px 5px;margin-left:5px;font-family:IBM Plex Mono,monospace;">vibration-derived</span>'
      : '';
    return '<div class="fault-item">'
      + '<div class="fault-name" style="color:'+col+';">'+f.name+derivedTag+'</div>'
      + '<div class="fault-bar-wrap"><div class="fault-bar-fill" style="background:'+col+';" data-w="'+f.pct+'"></div></div>'
      + '<div class="fault-pct" style="color:'+col+';">'+faultIndicatorLabel(f.pct)+'</div>'
      + '</div>';
  }).join('');

  const lockedHtml = lockedFaults.slice(0, 4).map(f =>
    '<div class="fault-item fault-locked">'
    + '<div class="fault-name" style="color:var(--dim);">[lock] '+f.name+'</div>'
    + '<div class="fault-bar-wrap"><div style="height:100%;background:var(--surface3);border-radius:3px;width:100%;"></div></div>'
    + '<div class="fault-pct" style="color:var(--dim);font-size:9px;">N/A</div>'
    + '</div>'
  ).join('');

  document.getElementById('fault-bars').innerHTML = unlockedHtml + (lockedFaults.length ? '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:9px;color:var(--muted);font-family:IBM Plex Mono,monospace;margin-bottom:6px;">Additional data required to analyse:</div>' + lockedHtml : '');
  setTimeout(()=>document.querySelectorAll('.fault-bar-fill').forEach(el=>el.style.width=el.dataset.w+'%'),80);
  const top=(d.faults.find(f=>!f.locked&&f.pct>0))||{name:' - ',pct:0,iso_reference:'',freq_hz:0,harmonics_used:0};
  document.getElementById('top-fault-badge').textContent=top.name+' · '+faultIndicatorLabel(top.pct);
  document.getElementById('top-fault-badge').className='badge '+(top.pct>=65?'b-red':top.pct>=40?'b-orange':top.pct>=20?'b-yellow':'b-blue');
  document.getElementById('driving-feature').textContent='Shaft ~'+(d.shaftHz||0).toFixed(1)+' Hz . Kurt '+d.kurt+' . CF '+d.cf+' . '+(top.harmonics_used||0)+' harmonics';
  document.getElementById('fault-clauses').innerHTML=top.iso_reference&&top.pct>0?'<span class="clause">'+top.iso_reference+'</span>':'';
  document.getElementById('rpm-badge').textContent='~'+Math.round((d.shaftHz||0)*60)+' RPM est.';
  document.getElementById('disclaimer-box').textContent='(!) '+CONFIG.chatbot_config.disclaimer_text;
  buildRadar(d.faults.filter(f => !f.locked)); buildFFT(d.fftR, d.sr);
  buildTrendChart(d, nvr._history || []);
}

// == CHARTS ==
Chart.defaults.color='#7f93aa';Chart.defaults.borderColor='#2a3a52';Chart.defaults.font.family="'IBM Plex Mono',monospace";

// == TREND CHART ============================================================
let trendInst = null;
let trendTab = 'rms';
window._lastTrendArgs = null;

window.switchTrendTab = function(tab) {
  trendTab = tab;
  document.querySelectorAll('.trend-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  if (window._lastTrendArgs) buildTrendChart(...window._lastTrendArgs);
};

// Colour per reading — baseline always blue
const TREND_PT_COLOURS = ['#4d9de0','#2ecc71','#f39c12','#e74c3c','#9b59b6','#1abc9c','#e67e22','#00bcd4'];

function buildTrendChart(d, history) {
  window._lastTrendArgs = [d, history];
  if (trendInst) { trendInst.destroy(); trendInst = null; }
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const formatDate = (iso) => {
    if (!iso) return '—';
    const dt = new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z');
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
  };

  // Build ordered list of all readings
  const readings = [];
  if (history && history.length > 0) {
    [...history].reverse().forEach((r, i) => {
      readings.push({
        label:     (r.filename ? r.filename.replace(/\.mat$/i,'') : 'Reading') + '  ·  ' + formatDate(r.recorded_at),
        date:      formatDate(r.recorded_at),
        rms:       parseFloat(r.rms_mms) || 0,
        health:    r.health_score != null ? parseFloat(r.health_score) : null,
        fault:     r.top_fault_pct || 0,
        isBaseline: !!r.is_baseline,
        isCurrent: false,
        colour:    i === 0 ? '#4d9de0' : TREND_PT_COLOURS[i % TREND_PT_COLOURS.length]
      });
    });
  }
  // Current reading
  const curDate = (d.machineParams && d.machineParams.measDate)
    ? d.machineParams.measDate : new Date().toISOString().split('T')[0];
  const curColour = readings.length === 0 ? '#4d9de0' : TREND_PT_COLOURS[readings.length % TREND_PT_COLOURS.length];
  readings.push({
    label:     d.filename.replace(/\.mat$/i,'') + '  ·  ' + formatDate(curDate) + '  (now)',
    date:      formatDate(curDate),
    rms:       parseFloat(d.rms),
    health:    d.healthIdx ? d.healthIdx.score : null,
    fault:     d.faults.find(f=>!f.locked&&f.pct>0)?.pct || 0,
    isBaseline: false,
    isCurrent:  true,
    colour:    curColour
  });

  const count = readings.length;
  const badge = document.getElementById('trend-reading-count');
  if (badge) badge.textContent = count + ' reading' + (count===1?'':'s') + (count<3?' — need 3+ for trend':'');
  const chartBadge = document.getElementById('trend-chart-badge');
  if (chartBadge) {
    chartBadge.textContent = d.trendRow.code + ' — ' + d.trendRow.label;
    const tC = {SWB:'b-green',DDU:'b-blue',PRS:'b-yellow',PRA:'b-red',RGI:'b-green',SCO:'b-red'};
    chartBadge.className = 'badge ' + (tC[d.trendRow.code]||'b-blue');
  }

  const isRMS = trendTab === 'rms';
  const labels = readings.map(r => r.date);
  const values = readings.map(r => isRMS ? r.rms : r.health);
  const ptColours = readings.map(r => r.isBaseline ? '#4d9de0' : r.colour);
  const ptBorder  = readings.map(r => r.isCurrent ? '#ffffff' : '#1a2030');
  const ptRadius  = readings.map(r => r.isCurrent ? 9 : r.isBaseline ? 8 : 7);
  const ptStyle   = readings.map(r => r.isBaseline ? 'rectRot' : 'circle');

  // Baseline reference line (horizontal dashed)
  const baselineVal = readings.find(r => r.is_baseline || readings.indexOf(r)===0);
  const baselineY   = isRMS ? (baselineVal?.rms||null) : (baselineVal?.health||null);

  const datasets = [
    // Main connected trend line
    {
      label: isRMS ? 'RMS mm/s' : 'Health Index',
      data: values,
      borderColor: 'rgba(255,255,255,0.25)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [5,4],
      pointRadius: ptRadius,
      pointBackgroundColor: ptColours,
      pointBorderColor: ptBorder,
      pointBorderWidth: 2,
      pointStyle: ptStyle,
      tension: 0.35,
      spanGaps: true,
      fill: false
    }
  ];

  // Baseline reference horizontal line
  if (baselineY !== null) {
    datasets.push({
      label: 'Baseline reference',
      data: readings.map(() => baselineY),
      borderColor: '#4d9de0',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [3,5],
      pointRadius: 0,
      tension: 0,
      fill: false
    });
  }

  trendInst = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2030',
          borderColor: '#3a5070',
          borderWidth: 1,
          padding: 10,
          titleColor: '#ffffff',
          bodyColor: '#c0cfe0',
          callbacks: {
            title: items => readings[items[0].dataIndex]?.label || items[0].label,
            label: c => {
              if (c.dataset.label === 'Baseline reference') return ' Baseline: ' + (isRMS ? baselineY.toFixed(3)+' mm/s' : baselineY+'/100');
              if (c.raw === null) return null;
              return isRMS
                ? ' RMS: ' + (c.raw||0).toFixed(3) + ' mm/s'
                : ' Health: ' + c.raw + '/100';
            }
          }
        },
        // Coloured point annotations in legend area
        annotation: {}
      },
      scales: {
        x: {
          grid: { color: 'rgba(77,157,224,0.08)' },
          ticks: { color: '#7f93aa', font: { size: 10 }, maxRotation: 30 }
        },
        y: isRMS ? {
          grid: { color: 'rgba(77,157,224,0.08)' },
          ticks: { color: '#7f93aa', font: { size: 9 } },
          title: { display: true, text: 'RMS mm/s', color: '#7f93aa', font: { size: 9 } }
        } : {
          min: 0, max: 100,
          grid: { color: 'rgba(77,157,224,0.08)' },
          ticks: { color: '#7f93aa', font: { size: 9 } },
          title: { display: true, text: 'Health Index (0-100)', color: '#7f93aa', font: { size: 9 } }
        }
      }
    }
  });

  // Build custom colour legend below chart
  const legendEl = document.getElementById('trend-legend');
  if (legendEl) {
    legendEl.innerHTML = readings.map(r =>
      '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:9px;color:var(--muted);font-family:IBM Plex Mono,monospace;">'
      + '<span style="width:10px;height:10px;border-radius:50%;background:'+r.colour+';border:1.5px solid '+(r.isBaseline?'#fff':'#1a2030')+';flex-shrink:0;"></span>'
      + r.label
      + '</span>'
    ).join('');
  }
}
// == END TREND CHART =========================================================

function buildRadar(faults){
  if(radarInst){radarInst.destroy();radarInst=null;}
  const top = faults.slice(0,8);
  if(!top.length) return;
  // Severity-coded dot colours — small clean dots, no white border clutter
  const severityColor = pct =>
    pct >= 65 ? '#ef4444' :   // Critical / Strong — red
    pct >= 40 ? '#f97316' :   // Elevated — orange
    pct >= 20 ? '#f59e0b' :   // Indicative — amber
                '#4d9de0';    // Low / Trace — blue
  const ptColors = top.map(f => severityColor(f.pct));

  const canvas = document.getElementById('radarChart');
  // Reset any previous inline styles
  canvas.style.width = '';
  canvas.style.height = '';
  canvas.style.marginLeft = '';
  canvas.style.marginTop = '';

  radarInst = new Chart(canvas.getContext('2d'),{
    type:'radar',
    data:{
      labels: top.map(f=>f.name.split(' - ').pop().trim().split(' ').slice(0,3).join(' ')),
      datasets:[{
        data: top.map(f=>f.pct),
        backgroundColor: 'rgba(192,57,43,0.18)',
        borderColor: '#c0392b',
        borderWidth: 2,
        pointBackgroundColor: ptColors,
        pointBorderColor: ptColors,   // no white ring — dot only
        pointBorderWidth: 0,
        pointRadius: 4,               // uniform small dots
        pointHoverRadius: 7,
        pointStyle: 'circle'
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#1a2030',
          borderColor:'#c0392b',
          borderWidth:1,
          padding:10,
          titleColor:'#ffffff',
          bodyColor:'#ffffff',
          callbacks:{label:c=>faultIndicatorLabel(c.raw)+' ('+c.raw+')'}
        }
      },
      scales:{
        r:{
          min:0, max:100,
          grid:{color:'rgba(77,157,224,0.15)'},
          angleLines:{color:'rgba(77,157,224,0.2)'},
          ticks:{
            backdropColor:'rgba(26,36,53,0.85)',
            color:'#e8edf5',
            font:{size:9},
            stepSize:25,
            showLabelBackdrop:true
          },
          pointLabels:{
            color:'#e8edf5',
            font:{size:12, weight:'600'}
          }
        }
      }
    }
  });
}

function buildFFT(fft,fs){
  if(fftInst){fftInst.destroy();fftInst=null;}
  const {freqs,mags}=fft, step=Math.max(1,Math.floor(freqs.length/400));
  const df=[],dm=[],dc=[];
  let dI=0; for(let i=1;i<mags.length;i++){if(mags[i]>mags[dI])dI=i;} const tF=freqs[dI];
  for(let i=0;i<freqs.length&&freqs[i]<fs*0.45;i+=step){const f=freqs[i];df.push(f.toFixed(1));dm.push(parseFloat(mags[i].toFixed(5)));dc.push(Math.abs(f-tF)<tF*0.15?'rgba(192,57,43,1.0)':Math.abs(f-tF*2)<tF*0.15?'rgba(211,84,0,1.0)':Math.abs(f-tF*3)<tF*0.15?'rgba(183,149,11,1.0)':f>fs*0.35?'rgba(88,44,140,0.9)':'rgba(0,85,170,0.5)');}
  fftInst=new Chart(document.getElementById('fftChart').getContext('2d'),{type:'bar',data:{labels:df,datasets:[{data:dm,backgroundColor:dc,barPercentage:1.3,categoryPercentage:1,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:400},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a2030',borderColor:'#c0392b',borderWidth:1,titleColor:'#ffffff',bodyColor:'#ffffff',callbacks:{title:i=>i[0].label+' Hz',label:c=>' '+c.raw.toFixed(5)}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:10,font:{size:10,weight:'bold'},color:'#7f93aa',callback:(v,i)=>parseFloat(df[i])%50<5?df[i]+'Hz':''}},y:{grid:{color:'rgba(77,157,224,0.12)'},ticks:{font:{size:10,weight:'bold'},color:'#7f93aa'},min:0}}}});
  document.getElementById('fft-legend').innerHTML=['Dominant freq','2nd harmonic','3rd harmonic','High-freq'].map((l,i)=>{const cs=['#c0392b','#c0520a','#b36a00','#6b3fa0'][i];return'<div style="display:flex;align-items:center;gap:4px;font-size:9px;color:'+cs+';font-family:\'IBM Plex Mono\',monospace;"><div style="width:7px;height:7px;border-radius:50%;background:'+cs+'"></div>'+l+'</div>';}).join('');
}

// ══ RAG — KNOWLEDGE BASE RETRIEVAL ═══════════════════════════════════════
// Calls worker /embed → Voyage AI (server-side key) then
// worker /rag   → Supabase match_knowledge_chunks (server-side service key).
// Falls back silently — RAG failure must never block the AI report.
const PROXY_BASE = 'https://restless-tree-eac8.kairosventure-io.workers.dev';
const RAG_MATCH_COUNT = 5;
const RAG_MIN_SIMILARITY = 0.30;

async function ragQuery(queryText) {
  try {
    // Step 1 — embed the query via worker (Voyage key stays server-side)
    const embedRes = await fetch(PROXY_BASE + '/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: queryText })
    });
    if (!embedRes.ok) throw new Error('embed HTTP ' + embedRes.status);
    const { embedding } = await embedRes.json();
    if (!embedding || !embedding.length) throw new Error('no embedding returned');

    // Step 2 — vector search via worker (Supabase service key stays server-side)
    const ragRes = await fetch(PROXY_BASE + '/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_embedding: embedding, match_count: RAG_MATCH_COUNT })
    });
    if (!ragRes.ok) throw new Error('rag HTTP ' + ragRes.status);
    const chunks = await ragRes.json();
    if (!Array.isArray(chunks)) throw new Error('unexpected rag response');

    return chunks.filter(c => (c.similarity || 0) >= RAG_MIN_SIMILARITY);
  } catch (e) {
    console.warn('[RAG] retrieval failed (non-blocking):', e.message);
    return [];
  }
}

function buildRagContext(chunks) {
  if (!chunks || chunks.length === 0) return '';
  const lines = [
    '=== KNOWLEDGE BASE CONTEXT ===',
    'The following excerpts were retrieved from the LynxEye knowledge base via semantic search.',
    'Use them to enrich your analysis where directly relevant. Do NOT fabricate beyond what is shown.',
    ''
  ];
  chunks.forEach((c, i) => {
    const src  = c.source_label || c.source_file || 'KB';
    const cat  = c.category || '';
    const sim  = c.similarity ? (c.similarity * 100).toFixed(0) + '%' : '';
    const text = (c.content || c.chunk_text || '').trim().slice(0, 600);
    lines.push(`[${i+1}] SOURCE: ${src}${cat ? ' | ' + cat : ''} | SIM: ${sim}`);
    lines.push(text);
    lines.push('');
  });
  return lines.join('\n');
}

// == CLAUDE AI ==
async function streamClaude(){
  const d=nvr;
  document.getElementById('stream-thinking').style.display='flex';
  document.getElementById('reco-text').textContent='';
  document.getElementById('reco-text').classList.add('typing');
  const mi=getMonitoringInterval(d.zoneRow.zone_label,d.trendRow.code);
  const flags=[];
  if(d.singleFile)flags.push('SINGLE_FILE: Trend is DDU. One snapshot only  -  do NOT imply deterioration trajectory.');
  if(!d.singleFile)flags.push('MULTI_READING: Trend '+d.trendRow.code+' derived from '+d.historyCount+' historical readings. Trend direction is established.');
  if(d.faults[0]&&d.faults[0].pct<40)flags.push('LOW_CONFIDENCE: Top fault '+d.faults[0].pct+'%  -  use indicative language only.');
  const zA=getZonesForClass(selClassId)[0];
  if(parseFloat(d.rms)<zA.rms_upper_mm_s)flags.push('ZONE_A: Machine in Zone A. Routine monitoring only  -  do not over-diagnose.');
  const fd=d.faults.slice(0,CONFIG.fault_display_limit).map(f=>'- '+f.name+': '+faultIndicatorLabel(f.pct)+' (score '+f.pct+') | freq: '+(f.freq_hz?f.freq_hz.toFixed(1)+' Hz':'N/A')+' | harmonics: '+(f.harmonics_used||0)+' | '+f.iso_reference).join('\n');

  // ── RAG — build semantic query from NVR context, retrieve KB chunks ────────
  // Query is constructed from the most diagnostically relevant fields so that
  // the vector search returns KB content matching this machine's fault profile.
  const topFault = d.faults.find(f=>!f.locked) || d.faults[0];
  const ragQueryText = [
    d.classRow.machine_type_desc,
    'ISO Zone ' + d.zoneRow.zone_label,
    topFault ? topFault.name : '',
    'kurtosis ' + d.kurt,
    'crest factor ' + d.cf,
    d.trendRow.label,
    d.zoneRow.action_required
  ].filter(Boolean).join(' ');

  const ragChunks = await ragQuery(ragQueryText);
  const ragSection = buildRagContext(ragChunks);
  // ─────────────────────────────────────────────────────────────────────────

  const prompt=[
    'You are LynxEye Assist  -  domain-ringfenced to vibration analysis, condition monitoring, rotating machinery, and maintenance engineering ONLY.',
    '','=== MACHINE ===',
    d.classRow.machine_type_desc+' | '+d.classRow.iso_standard_ref+' | '+d.classRow.mounting_type+' mount',
    '','=== NVR RECORD ===',
    'File: '+d.filename+' | Samples: '+d.n+' | Sample rate: '+d.sr+' Hz',
    'RMS: '+d.rms+' '+d.cu+' | Peak: '+d.peak+' | CF: '+d.cf+' ['+getCFLabel(parseFloat(d.cf))+'] | Kurtosis: '+d.kurt+' ['+getKLabel(parseFloat(d.kurt))+']',
    'Deviation: '+d.devSc+'sigma  -  '+d.devRow.classification+' ('+d.devRow.iso_reference+')',
    'ISO Zone: '+d.zoneRow.zone_label+'  -  '+d.zoneRow.action_required+' ('+d.zoneRow.iso_clause_ref+')',
    'Trend: '+d.trendRow.code+'  -  '+d.trendRow.label+' ('+d.trendRow.iso_reference+')',
    'Early Warning: '+d.earlyWarn+(d.earlyWarn?' ('+CONFIG.early_warning_rule.iso_reference+')':''),
    'RUL: '+d.rulR.days+'d +/- '+d.rulR.ci+'d ('+d.rulR.iso_reference+')',
    'Monitoring: '+mi.interval_desc+' ('+mi.iso_reference+')',
    'Shaft: '+(d.shaftHz?d.shaftHz.toFixed(1):'?')+' Hz (~'+Math.round((d.shaftHz||0)*60)+' RPM)',
    '','=== FAULT CLASSIFICATION ===',fd,
    '','=== DATA QUALITY FLAGS ===',
    flags.length?flags.map(f=>'(!) '+f).join('\n'):' -  No flags.',
    '',
    ragSection,  // injected KB context — empty string if RAG unavailable
    '=== ANTI-HALLUCINATION RULES ===',
    '1. Use ONLY values from the NVR RECORD above. Do not invent bearing models, temperatures, or values not in this data.',
    '2. Obey every DATA QUALITY FLAG.',
    '3. Fault <40% confidence = indicative language only, never confirmed.',
    '4. Cite ONLY ISO clauses from the NVR record above.',
    '5. Always quote RUL CI. State it cannot replace engineering judgement.',
    ragChunks.length ? '6. Where KNOWLEDGE BASE CONTEXT excerpts are directly relevant, you may reference them to support your analysis. Do not quote them verbatim — synthesise into your report.' : '',
    '','=== REPORT  -  6 SECTIONS ===',
    '1. DIAGNOSTIC SUMMARY  -  Zone, RMS, trend, limitations.',
    '2. PRIMARY FAULT ANALYSIS  -  Interpret top fault(s), qualify confidence, cite ISO 13379-1 clause.',
    '3. SEVERITY ASSESSMENT  -  Interpret zone, cite exact ISO clause from NVR record.',
    '4. RECOMMENDED ACTIONS  -  Immediate/Short-term/Long-term. Each must cite an ISO clause.',
    '5. MONITORING GUIDANCE  -  Interval and parameters. Cite ISO 13373-1 clause.',
    '6. RUL & PROGNOSTIC NOTE  -  Quote days and CI. Cite ISO 13381-1 clause. State limitations.',
  ].filter(s=>s!==undefined).join('\n');
  try{
    const resp=await fetch(PROXY_BASE+'/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CONFIG.chatbot_config.model_version,max_tokens:CONFIG.chatbot_config.max_output_tokens,stream:true,messages:[{role:'user',content:prompt}]})});
    document.getElementById('stream-thinking').style.display='none';
    if(!resp.ok)throw new Error(await resp.text());
    const reader=resp.body.getReader(),dec=new TextDecoder();let buf='',fullText='';
    const rt=document.getElementById('reco-text');
    rt.innerHTML='';
    let streamDone=false;
    while(!streamDone){
      const{done,value}=await reader.read();
      if(done)break;
      buf+=dec.decode(value,{stream:true});
      const ls=buf.split('\n');buf=ls.pop();
      for(const l of ls){
        if(!l.startsWith('data:'))continue;
        const dat=l.slice(5).trim();
        if(dat==='[DONE]'){streamDone=true;break;}
        try{
          const e=JSON.parse(dat);
          if(e.type==='content_block_delta'&&e.delta?.type==='text_delta'){
            fullText+=e.delta.text;
            rt.innerHTML=mdToHtml(fullText);
          }
        }catch{}
      }
    }
    // Final render — only if we have content
    if(fullText) rt.innerHTML=mdToHtml(fullText);
  }catch(err){
    document.getElementById('stream-thinking').style.display='none';
    document.getElementById('reco-text').innerHTML = mdToHtml(buildFallback(nvr));
  }
  document.getElementById('reco-text').classList.remove('typing');
}


// ══ FREEMIUM GATE RENDERER ═══════════════════════════════════════════════
function applyFreemiumGates() {
  if (Freemium.isPro()) return;

  const count = Freemium.getCount();

  // ── Update nav badge ──────────────────────────────────────────────────
  if (typeof window.updateFreeBadge === 'function') window.updateFreeBadge();
  const pdfBtn = document.getElementById('pdf-btn');
  if (pdfBtn) {
    pdfBtn.style.display = '';  // keep visible but intercept click
    pdfBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      Freemium.showUpgradeModal('feature');
    };
    // Visual cue — lock badge
    if (!pdfBtn.dataset.gated) {
      pdfBtn.dataset.gated = '1';
      pdfBtn.style.opacity = '0.55';
      pdfBtn.style.cursor  = 'not-allowed';
      pdfBtn.title = 'PDF export requires Professional plan';
    }
  }

  // ── Watermark on results screen ───────────────────────────────────────
  // Applied on every free analysis — removed cleanly when user upgrades
  const rs = document.getElementById('results-screen');
  if (rs && !rs.querySelector('#ax-watermark')) {
    const wm = document.createElement('div');
    wm.id = 'ax-watermark';
    wm.setAttribute('aria-hidden', 'true');
    wm.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%) rotate(-35deg)',
      'font-family:\'Barlow Condensed\',sans-serif',
      'font-size:clamp(28px,5vw,56px)',
      'font-weight:800',
      'letter-spacing:6px',
      'color:rgba(77,157,224,0.06)',
      'white-space:nowrap',
      'pointer-events:none',
      'user-select:none',
      'z-index:9000',
    ].join(';');
    wm.textContent = 'LYNXEYE FREE TRIAL';
    rs.style.position = rs.style.position || 'relative';
    rs.appendChild(wm);
  }

  // ── Free trial banner below results header ────────────────────────────
  const existingBanner = document.getElementById('ax-trial-banner');
  if (!existingBanner) {
    const banner = document.createElement('div');
    banner.id = 'ax-trial-banner';
    banner.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'flex-wrap:wrap',
      'gap:8px',
      'background:rgba(77,157,224,0.07)',
      'border:1px solid rgba(77,157,224,0.22)',
      'border-radius:8px',
      'padding:10px 16px',
      'margin:0 0 18px',
      'font-family:\'IBM Plex Mono\',monospace',
      'font-size:10px',
      'color:#7f93aa',
    ].join(';');

    const remaining = FREE_ANALYSIS_LIMIT - count;
    const remainText = remaining > 0
      ? remaining + ' free ' + (remaining === 1 ? 'analysis' : 'analyses') + ' remaining'
      : 'Free trial complete';

    banner.innerHTML = `
      <span>&#9888; Free Trial &nbsp;·&nbsp; ${remainText} &nbsp;·&nbsp; PDF export and fleet management require Professional</span>
      <a href="landing.html#pricing" style="color:#4d9de0;text-decoration:none;font-weight:600;white-space:nowrap;">View Plans &#8599;</a>
    `;

    // Insert just above the results content
    const resultsMeta = document.getElementById('results-meta');
    if (resultsMeta && resultsMeta.parentNode) {
      resultsMeta.parentNode.insertBefore(banner, resultsMeta);
    }
  } else {
    // Update remaining count on subsequent analyses
    const remaining = FREE_ANALYSIS_LIMIT - count;
    const remainText = remaining > 0
      ? remaining + ' free ' + (remaining === 1 ? 'analysis' : 'analyses') + ' remaining'
      : 'Free trial complete';
    existingBanner.querySelector('span').innerHTML =
      `&#9888; Free Trial &nbsp;·&nbsp; ${remainText} &nbsp;·&nbsp; PDF export and fleet management require Professional`;
  }

  // ── After limit reached — show upgrade modal ──────────────────────────
  if (count >= FREE_ANALYSIS_LIMIT) {
    setTimeout(() => Freemium.showUpgradeModal('limit'), 2000);
  }
}

// == FALLBACK REPORT ==
function buildFallback(d){
  // Top unlocked fault only — locked faults (MCSA/power) excluded
  const unlockedFaults = d.faults.filter(f=>!f.locked);
  // Use top unlocked fault regardless of minimum threshold — threshold only controls display bars
  // For healthy machines, top fault will be low % — use indicative language accordingly
  const top = unlockedFaults[0]
    || {name:'No significant fault detected',pct:0,iso_reference:'ISO 13379-1:2012',freq_hz:null,harmonics_used:0,category:'none'};
  // Secondary = next unlocked fault (not locked MCSA/power faults)
  const sec = unlockedFaults.find(f=>f!==top&&f.pct>=CONFIG.minimum_fault_confidence_pct);
  const mi=getMonitoringInterval(d.zoneRow.zone_label,d.trendRow.code);
  const allZ=getZonesForClass(selClassId);
  const zI=allZ.findIndex(z=>z.zone_label===d.zoneRow.zone_label);
  const urg=zI===allZ.length-1?'IMMEDIATE SHUTDOWN':zI===allZ.length-2?'URGENT  -  within 7 days':'PLANNED  -  within 90 days';
  const cq=top.pct>=60?'':'indicative of ';
  const fA=top.name.includes('Outer Race')?'Spectral signature is '+cq+'outer race bearing defect (BPFO). CF ('+d.cf+') and Kurtosis ('+d.kurt+') '+(top.pct>=60?'confirm':'suggest')+' impacting behaviour. '+top.harmonics_used+' harmonic(s) at ~'+(top.freq_hz?top.freq_hz.toFixed(1):'est.')+' Hz. Per '+top.iso_reference+'.':top.name.includes('Inner Race')?'Spectral signature is '+cq+'inner race bearing defect. Kurtosis ('+d.kurt+') provides supporting evidence. '+top.harmonics_used+' harmonic(s) matched. Per '+top.iso_reference+'.':top.name.includes('Rolling Element')?'Spectral signature is '+cq+'rolling element (ball) bearing defect. CF ('+d.cf+') and envelope analysis provide supporting evidence. '+top.harmonics_used+' harmonic(s) matched. Per '+top.iso_reference+'.':top.name.includes('Cage')?'Spectral signature is '+cq+'cage/train defect (FTF). '+top.harmonics_used+' harmonic(s) matched. Per '+top.iso_reference+'.':top.name.includes('Imbalance')?'1x shaft frequency component is '+cq+'mechanical imbalance. '+top.harmonics_used+' harmonic(s) at ~'+(top.freq_hz?top.freq_hz.toFixed(1):'est.')+' Hz. Per '+top.iso_reference+'.':top.name.includes('Misalignment')?'2x/3x harmonic content is '+cq+'shaft misalignment. '+top.harmonics_used+' harmonic(s) matched. Per '+top.iso_reference+'.':top.name.includes('Looseness')?'Multiple sub-harmonics are '+cq+'mechanical looseness. '+top.harmonics_used+' matched. Per '+top.iso_reference+'.':'Spectral signature is '+cq+top.name+'. '+top.harmonics_used+' harmonic(s) matched. Per '+top.iso_reference+'.';
  return '## 1. Diagnostic Summary\nISO Zone '+d.zoneRow.zone_label+' ('+d.zoneRow.iso_clause_ref+'). RMS: '+d.rms+' '+d.cu+' on '+d.classRow.machine_type_desc+'.\n'+d.zoneRow.action_required+'\nDeviation: '+d.devSc+'sigma ('+d.devRow.classification+', '+d.devRow.iso_reference+').\nTrend: '+d.trendRow.code+'  -  '+d.trendRow.description+' ('+d.trendRow.iso_reference+').\n'+(d.singleFile?'\nNote: Single measurement file  -  trend direction cannot be established from one snapshot. Multiple readings required per '+d.trendRow.iso_reference+'.':'\nNote: Trend '+d.trendRow.code+' derived from '+d.historyCount+' readings ('+d.trendRow.iso_reference+').')+'\n\n## 2. Primary Fault Analysis\n*'+top.iso_reference+'*\n\n'+top.name+': Fault Indicator — '+faultIndicatorLabel(top.pct)+'.\n'+fA+(sec?'\nSecondary indicator: '+sec.name+' — '+faultIndicatorLabel(sec.pct)+' ('+sec.iso_reference+').':'')+'\n\n## 3. Recommended Actions\n**Immediate:**\n'+(zI===allZ.length-1?'* Controlled shutdown required. Do not restart without engineering authorisation. ('+d.zoneRow.iso_clause_ref+')':zI===allZ.length-2?'* Schedule maintenance within 7 days. ('+d.zoneRow.iso_clause_ref+')':'* Continue current schedule. Document per ISO 55001:2014 S7.5.')+'\n\n**Short-term:**\n* '+((top.category==='bearing'&&top.pct>=20)?'Inspect bearing. Verify lubrication per ISO 13373-1:2002 S6.2.':top.category==='bearing'?'Monitor bearing condition. Re-measure at next scheduled interval ('+mi.interval_desc+'). Track CF and Kurtosis trend (ISO 13373-2:2016 §8.2).':top.name.includes('Imbalance')?'Dynamic balance per ISO 1940-1.':top.name.includes('Misalignment')?'Precision alignment. Check soft-foot per ISO 10816-3.':top.name.includes('Looseness')?'Inspect hold-down bolts, grout and baseplate integrity.':'Continue monitoring. Re-baseline post any maintenance (ISO 13373-2:2016 S8.1).')+'\n\n**Long-term:**\n* Re-baseline post-maintenance (ISO 13373-2:2016 S8.1).\n\n## 4. Monitoring Guidance\n*'+mi.iso_reference+'*\n\nInterval: '+mi.interval_desc+'.\nMeasure H/V/A at bearing housings (ISO 13373-1:2002 S5.2). Track RMS, CF, Kurtosis.\n\n## 5. RUL & Prognostic Note\n*'+d.rulR.iso_reference+'*\n\nRUL: '+d.rulR.days+'d +/- '+d.rulR.ci+'d CI.\n'+(d.rulR.days<60?'Below 60 days  -  begin maintenance planning immediately.':'Continue trending to improve RUL accuracy.')+'\nPer '+d.rulR.iso_reference+': this estimate must not be the sole criterion for maintenance deferral. Qualified engineering review required.';
}

// == MARKDOWN RENDERER ==
// Minimal markdown→HTML for Claude AI report output.
// Handles: ## headers, **bold**, bullet lists, numbered lists, line breaks.
// No external dependency — runs entirely in-browser.
function mdToHtml(md) {
  if (!md) return '';
  const lines = md.split('\n');
  const out = [];
  let inList = false, inNumList = false;

  const closeList = () => {
    if (inList)    { out.push('</ul>'); inList = false; }
    if (inNumList) { out.push('</ol>'); inNumList = false; }
  };

  const inline = t => t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();

    // H1
    if (/^#\s+/.test(line)) {
      closeList();
      out.push(`<h2 class="reco-h1">${inline(line.replace(/^#\s+/,''))}</h2>`);
      continue;
    }
    // H2
    if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h3 class="reco-h2">${inline(line.replace(/^##\s+/,''))}</h3>`);
      continue;
    }
    // H3
    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h4 class="reco-h3">${inline(line.replace(/^###\s+/,''))}</h4>`);
      continue;
    }
    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      if (!inNumList) { out.push('<ol class="reco-list">'); inNumList = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/,''))}</li>`);
      continue;
    }
    // Bullet list
    if (/^[-*•]\s+/.test(line)) {
      if (inNumList) { out.push('</ol>'); inNumList = false; }
      if (!inList) { out.push('<ul class="reco-list">'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*•]\s+/,''))}</li>`);
      continue;
    }
    // Blank line
    if (!line.trim()) {
      closeList();
      out.push('<br>');
      continue;
    }
    // Paragraph
    closeList();
    out.push(`<p class="reco-p">${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

  // ── Expose internals for multiChannel.js ─────────────────────────────────
  // Functions are inside DOMContentLoaded scope — expose as window globals
  // so multiChannel.js (loaded as separate script) can call them.
  window.CONFIG              = CONFIG;
  window.computeFFT          = computeFFT;
  window.detectShaft         = detectShaft;
  window.toCanonicalUnit     = toCanonicalUnit;
  window.classifyFaults      = classifyFaults;
  window.lookupZone          = lookupZone;
  window.classifyDeviation   = classifyDeviation;
  window.applyFaultOverride  = applyFaultOverride;
  window.calcRUL             = calcRUL;
  window.calcHealthIndex     = calcHealthIndex;
  window.detectDataTypes     = detectDataTypes;
  window.faultIndicatorColor = faultIndicatorColor;
  window.faultIndicatorLabel = faultIndicatorLabel;
  window.__getSelClassId     = function() { return selClassId; };
  window.renderResults       = renderResults;
  window.mdToHtml            = mdToHtml;
  // nvr is a let — expose via getter/setter so multiChannel.js can inject worst-channel data
  Object.defineProperty(window, 'nvr', {
    get: function() { return nvr; },
    set: function(v) { nvr = v; },
    configurable: true,
  });

  // == PDF / PRINT ==
  // Prepares the page for printing then triggers window.print().
  // Print CSS (in index.html <style id="print-style">) handles layout.
  window.axiomPrint = function() {
    // Freemium gate — PDF/print requires Professional
    if (Freemium.isFree()) {
      Freemium.showUpgradeModal('feature');
      return;
    }
    // Inject report metadata into print header
    const d = nvr;
    const isMulti = window.MC?.enabled && window.MC?.results?.length > 0;
    const reportType = isMulti ? 'Multi-Channel Diagnostic Report' : 'Diagnostic Report';
    const assetLabel = d?.assetName || d?.filename || '—';
    const dateLabel = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    let hdr = document.getElementById('print-header');
    if (!hdr) {
      hdr = document.createElement('div');
      hdr.id = 'print-header';
      document.body.prepend(hdr);
    }
    hdr.innerHTML = `
      <div class="ph-logo"><svg viewBox="0 0 40 24" style="width:80%;height:80%;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3,13 Q18,2 37,10" fill="none" stroke="#4d9de0" stroke-width="2" stroke-linecap="round"/><path d="M3,13 Q19,21 37,10" fill="none" stroke="#4d9de0" stroke-width="2" stroke-linecap="round"/><g transform="translate(19,11)"><path d="M2.7,0 L4.29,0.54 L4.19,1.07 L2.51,0.99 L2.18,1.59 L3.15,2.96 L2.75,3.33 L1.45,2.28 L0.83,2.57 L0.81,4.24 L0.27,4.31 L-0.17,2.69 L-0.83,2.57 L-1.84,3.91 L-2.32,3.65 L-1.72,2.08 L-2.18,1.59 L-3.79,2.08 L-4.02,1.59 L-2.62,0.67 L-2.7,0 L-4.29,-0.54 L-4.19,-1.07 L-2.51,-0.99 L-2.18,-1.59 L-3.15,-2.96 L-2.75,-3.33 L-1.45,-2.28 L-0.83,-2.57 L-0.81,-4.24 L-0.27,-4.31 L0.17,-2.69 L0.83,-2.57 L1.84,-3.91 L2.32,-3.65 L1.72,-2.08 L2.18,-1.59 L3.79,-2.08 L4.02,-1.59 L2.62,-0.67 Z" fill="#4d9de0"/><circle r="1.5" fill="#1a2030"/></g><g transform="translate(25.4,8.6)"><path d="M2,0 L3.56,0.56 L3.42,1.11 L1.76,0.9 L1.4,1.4 L2.11,2.91 L1.63,3.21 L0.61,1.88 L0,2 L-0.56,3.56 L-1.11,3.42 L-0.9,1.76 L-1.4,1.4 L-2.91,2.11 L-3.21,1.63 L-1.88,0.61 L-2,0 L-3.56,-0.56 L-3.42,-1.11 L-1.76,-0.9 L-1.4,-1.4 L-2.11,-2.91 L-1.63,-3.21 L-0.61,-1.88 L0,-2 L0.56,-3.56 L1.11,-3.42 L0.9,-1.76 L1.4,-1.4 L2.91,-2.11 L3.21,-1.63 L1.88,-0.61 Z" fill="#4d9de0"/><circle r="1.3" fill="#1a2030"/></g></svg></div>
      <div class="ph-title">
        <div class="ph-name">LynxEye</div>
        <div class="ph-sub">Agnostic · Augmented AI Analysis</div>
      </div>
      <div class="ph-meta">
        <div class="ph-report-type">${reportType}</div>
        <div class="ph-details">Asset: ${assetLabel} &nbsp;·&nbsp; ${dateLabel}</div>
        <div class="ph-iso">ISO 10816 · ISO 13373 · ISO 13379 · ISO 13381</div>
      </div>
    `;

    // Mark body with MC mode class so print CSS can hide single-channel cards
    if (isMulti) {
      document.body.classList.add('mc-print-mode');
    } else {
      document.body.classList.remove('mc-print-mode');
    }

    // Brief delay to let print header render, then print
    setTimeout(() => {
      window.print();
      // Remove MC class after print dialog closes
      setTimeout(() => document.body.classList.remove('mc-print-mode'), 2000);
    }, 150);
  };

  // == BASELINE PROMPT ==
  window.showBaselinePrompt = function(assetName, zoneLabel) {
    if (!['A','B'].includes(zoneLabel)) return;
    const existing = document.getElementById('ax-baseline-prompt');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'ax-baseline-prompt';
    toast.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:8000;background:#161b22;border:1px solid rgba(77,157,224,0.5);border-radius:14px;padding:20px 22px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:slideUpIn 0.35s cubic-bezier(0.22,1,0.36,1) both;';
    if (!document.getElementById('ax-baseline-kf')) {
      const s = document.createElement('style'); s.id = 'ax-baseline-kf';
      s.textContent = '@keyframes slideUpIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
    const safeZone = zoneLabel;
    const safeName = (assetName || 'this asset').replace(/[<>]/g, '');
    toast.innerHTML = [
      "<div style='display:flex;align-items:flex-start;gap:12px;'>",
        "<div style='font-size:20px;flex-shrink:0;margin-top:1px;'>&#128204;</div>",
        "<div style='flex:1;min-width:0;'>",
          "<div style='font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:15px;color:#e8edf5;margin-bottom:4px;'>Set as baseline?</div>",
          "<div style='font-family:IBM Plex Mono,monospace;font-size:10px;color:#7f93aa;line-height:1.6;margin-bottom:14px;'>",
            "This Zone " + safeZone + " result looks healthy. Save as reference baseline for ",
            "<strong style='color:#e8edf5;'>" + safeName + "</strong>",
            " to enable deviation tracking on future readings.",
            "<span style='color:#4d9de0;display:block;margin-top:3px;'>ISO 13373-2:2016 §8.1</span>",
          "</div>",
          "<div style='display:flex;gap:8px;'>",
            "<button id='ax-bl-confirm' style='flex:1;padding:9px 0;background:#4d9de0;color:#fff;border:none;border-radius:8px;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:13px;cursor:pointer;' onmouseover='this.style.background=\"#2b7cc4\"' onmouseout='this.style.background=\"#4d9de0\"'> &#10003; Set Baseline</button>",
            "<button id='ax-bl-dismiss' style='padding:9px 14px;background:transparent;color:#7f93aa;border:1px solid #30363d;border-radius:8px;font-family:IBM Plex Mono,monospace;font-size:10px;cursor:pointer;' onmouseover='this.style.borderColor=\"#7f93aa\"' onmouseout='this.style.borderColor=\"#30363d\"'> Not now</button>",
          "</div>",
        "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(toast);
    document.getElementById('ax-bl-dismiss').onclick = function(){ toast.remove(); };
    document.getElementById('ax-bl-confirm').onclick = async function() {
      const btn = document.getElementById('ax-bl-confirm');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        const mp = nvr.machineParams || {};
        const asset = await resolveAsset(mp.assetName||nvr.assetName||'unknown', window.selClassId||'cls_ii', mp.equipType||'', mp.measPoint||'');
        if (asset && asset.id) {
          const hist = nvr._history || [];
          const records = hist.filter(function(r){return r.iso_zone==='A';}).concat([{ rms_mms: nvr.rms }]);
          await saveBaseline(asset.id, records);
          await SB.patch('nvr_records','asset_id=eq.'+asset.id+'&order=recorded_at.desc&limit=1',{is_baseline:true}).catch(function(){});
          btn.innerHTML = '&#10003; Baseline saved'; btn.style.background = '#22c55e';
          setTimeout(function(){ toast.remove(); }, 2200);
        } else {
          btn.textContent = '(!) Login to save'; btn.style.background = '#e74c3c';
          setTimeout(function(){ toast.innerHTML += "<div style='margin-top:10px;font-family:IBM Plex Mono,monospace;font-size:10px;color:#7f93aa;text-align:center;'><a href='fleet.html' style='color:#4d9de0;text-decoration:none;'>Sign in to Fleet Dashboard</a> to save baselines</div>"; }, 400);
        }
      } catch(e){ btn.textContent='(!) Error'; btn.style.background='#e74c3c'; setTimeout(function(){ toast.remove(); },3000); }
    };
    setTimeout(function(){ if(document.getElementById('ax-baseline-prompt')) toast.remove(); }, 20000);
  };

  // == PRINT RADAR / FFT COLOUR OVERRIDE ==
  // Chart.js canvases use dark theme colours — redraw with print-friendly colours before printing
  window.addEventListener('beforeprint', function() {
    // Single-channel radar
    if (radarInst) {
      const r = radarInst.options.scales.r;
      r.grid.color        = 'rgba(0,0,0,0.15)';
      r.angleLines.color  = 'rgba(0,0,0,0.2)';
      r.ticks.backdropColor = 'rgba(255,255,255,0.9)';
      r.ticks.color       = '#333';
      r.pointLabels.color = '#1a1a2e';
      radarInst.data.datasets[0].borderColor     = '#c0392b';
      radarInst.data.datasets[0].backgroundColor = 'rgba(192,57,43,0.18)';
      radarInst.data.datasets[0].pointBorderColor = '#fff';
      radarInst.update('none');
    }
    // Single-channel FFT
    if (fftInst) {
      fftInst.options.scales.x.ticks.color = '#555';
      fftInst.options.scales.y.ticks.color = '#555';
      fftInst.options.scales.x.grid.color  = 'rgba(0,0,0,0.05)';
      fftInst.options.scales.y.grid.color  = 'rgba(0,0,0,0.08)';
      fftInst.update('none');
    }
    // MC radar
    if (window.mcRadarInst) {
      const r = window.mcRadarInst.options.scales.r;
      r.grid.color        = 'rgba(0,0,0,0.15)';
      r.angleLines.color  = 'rgba(0,0,0,0.2)';
      r.ticks.backdropColor = 'rgba(255,255,255,0.9)';
      r.ticks.color       = '#333';
      r.pointLabels.color = '#1a1a2e';
      window.mcRadarInst.data.datasets.forEach(ds => {
        ds.borderWidth = 2.5;
      });
      window.mcRadarInst.update('none');
    }
    // MC FFT
    if (window.mcFftInst) {
      window.mcFftInst.options.scales.x.ticks.color = '#555';
      window.mcFftInst.options.scales.y.ticks.color = '#555';
      window.mcFftInst.options.scales.x.grid.color  = 'rgba(0,0,0,0.05)';
      window.mcFftInst.options.scales.y.grid.color  = 'rgba(0,0,0,0.08)';
      window.mcFftInst.data.datasets.forEach(ds => { ds.borderWidth = 2; });
      window.mcFftInst.update('none');
    }
  });

  window.addEventListener('afterprint', function() {
    // Restore dark theme colours after print dialog closes
    if (radarInst) {
      const r = radarInst.options.scales.r;
      r.grid.color        = 'rgba(77,157,224,0.2)';
      r.angleLines.color  = 'rgba(77,157,224,0.25)';
      r.ticks.backdropColor = 'rgba(26,36,53,0.85)';
      r.ticks.color       = '#e8edf5';
      r.pointLabels.color = '#e8edf5';
      radarInst.update('none');
    }
    if (fftInst) {
      fftInst.options.scales.x.ticks.color = '#7f93aa';
      fftInst.options.scales.y.ticks.color = '#7f93aa';
      fftInst.options.scales.x.grid.color  = 'transparent';
      fftInst.options.scales.y.grid.color  = 'rgba(77,157,224,0.12)';
      fftInst.update('none');
    }
    if (window.mcRadarInst) {
      const r = window.mcRadarInst.options.scales.r;
      r.grid.color        = 'rgba(77,157,224,0.2)';
      r.angleLines.color  = 'rgba(77,157,224,0.25)';
      r.ticks.backdropColor = 'rgba(26,36,53,0.8)';
      r.ticks.color       = '#7f93aa';
      r.pointLabels.color = '#e8edf5';
      window.mcRadarInst.update('none');
    }
    if (window.mcFftInst) {
      window.mcFftInst.options.scales.x.ticks.color = '#7f93aa';
      window.mcFftInst.options.scales.y.ticks.color = '#7f93aa';
      window.mcFftInst.options.scales.x.grid.color  = 'transparent';
      window.mcFftInst.options.scales.y.grid.color  = 'rgba(77,157,224,0.1)';
      window.mcFftInst.data.datasets.forEach(ds => { ds.borderWidth = 1.5; });
      window.mcFftInst.update('none');
    }
  });

}); // end DOMContentLoaded
