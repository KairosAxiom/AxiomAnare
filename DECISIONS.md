# AxiomAnare — DECISIONS & GUARDRAILS

> The *why* behind the project, and the rules that keep the analysis honest.
> READ PART A every session before touching diagnostic or report logic.

---

## PART A — GUARDRAILS (active rules)

### A1. ISO clause references come from CONFIG only — never invented
Every clause reference is a stored CONFIG constant (per fault rule, zone, trend). The AI report prompt
carries an explicit ANTI-HALLUCINATION block: use ONLY values from the machine's record, cite ONLY ISO
clauses already in that record. The AI quotes constants, it does not freelance citations.
**So the risk is a wrong constant, not runtime hallucination — fixable in one place.**
⚠️ OPEN: verify the stored references against the real standards. The `§x.x` style looks conventional;
the `Table 1 S5.1` / `IEC 60034-14:2003 S5.2` style does NOT match ISO/IEC numbering — check `KB/Standards`.

### A2. Confidence drives language (enforced in prompt)
Below ~40% confidence → indicative language only. Display floor `minimum_fault_confidence_pct: 8`;
"Indicative" tier begins at score ≥ 20.
Note: this gates how the engine TALKS about a fault once a calculation has run. It is a different axis
from A10 (data quality), which gates whether a reading is trustworthy enough to calculate from at all.

### A3. No over-diagnosis in ISO Zone A (enforced via data-quality flag)
A `ZONE_A` flag tells the report: routine monitoring only, do not over-diagnose. Obey it.

### A4. Fault hierarchy is fixed
Vib-derived electrical faults capped at **19** — one below the Indicative threshold — so they can never
present as confident or outrank a direct vibration fault. MCSA-only electrical faults shown locked/greyed.
Mechanical scores capped at 10 when bearing envelope BER exceeds threshold.

### A5. RUL always carries the caveat (enforced in prompt)
Every RUL quotes its CI and states it cannot replace engineering judgement.

### A6. The benchmark is the arbiter, not memory
CWRU is ground truth. After ANY diagnostic/FFT/scoring change, re-run it. Score drops = regression = revert.

### A7. Liability disclaimer is non-negotiable
The CONFIG `disclaimer_text` must remain on every report.

### A8. RLS is closed and org-scoped — respect the tenancy model
The DB enforces org-scoping: a user sees only their org's data; admins see all; logged-out users have no org.
- Customer writes (assets/baselines/nvr_records/fault_detections) require an authenticated, org-scoped user.
- `bearing_library` keeps anon read so the free diagnostic still runs.
- **Implication:** any logged-out flow that writes nvr_records WILL FAIL. The free trial must run
  authenticated (tier lives on the profile anyway), or needs a deliberate scoped anon exception. Verify
  this hasn't silently broken the free flow.
- Never weaken a policy back to `USING (true)` to "make it work" — fix the auth path instead.

### A9. Free tier has no backups — export before destructive SQL
Supabase Free tier takes no automatic backups. Any `TRUNCATE` / `DROP` / destructive migration must be
preceded by a manual export. (The v2 RLS migration already truncated pre-RLS test data when it ran.)

### A10. Data quality tiers gate trend/RUL inputs, not single diagnostics (planned, not yet built)
Every `nvr_records` row should carry a `data_quality` tier (high | medium | low), computed from objective
acquisition criteria in CONFIG (sample rate margin over shaft frequency, capture duration in
revolutions, clipping/saturation check) — NOT from diagnostic confidence (that's A2). Low-quality
records must remain visible in the UI but be EXCLUDED from any trend fit or RUL calculation.
A separate `excluded_from_trend` boolean (manual, engineer-set) sits alongside `data_quality`
(automatic, objective) — a High-quality reading the engineer personally distrusts can be excluded
without misrepresenting its measured quality.
**Status: not yet implemented.** Build when Fleet trending / digital twin work starts (Phase 2).
See CONTEXT.md → Not Started, ARCHITECTURE.md §12.

### A11. Component replacement must reset trend/RUL history, not just the baseline (planned, not yet built)
When a physical component (e.g. a bearing) is replaced, any trend or RUL calculated against
pre-replacement readings is not just stale — it actively misleads (reads as a "miraculous recovery," or
masks a genuinely fresh fault by comparing it to a dead component's curve). On an engineer-confirmed
replacement: stamp `assets.component_changed_at`, mark the current `baselines` row superseded (not
deleted — keep history for audit), and require the diagnostic pipeline to filter trend/RUL inputs to
readings taken after the change. A fresh baseline is captured on the next analysis, same as a new asset.
**Status: not yet implemented.** Same Phase 2 timing as A10. See CONTEXT.md → Not Started,
ARCHITECTURE.md §13.

### A12. Mandatory input metadata — no silent defaults (formalized 6 Jul 2026, revised 7 Jul 2026, not yet built)
Any input value that feeds frequency-domain analysis — sample rate, RPM, bearing model — must be
explicitly provided, auto-detected from the file, or explicitly flagged as assumed. The engine must
NEVER silently substitute a default and proceed as if it were measured fact.

**Origin:** discovered during a diagnostic stress test (Trrish1.csv / Trrish2.csv via MQTT pipeline) —
the app was found to silently default to a 1.0 kHz sample rate when none was supplied, making every
downstream frequency value (BPFO/BPFI/BSF/FTF, shaft frequency) unverified without any indication to
the user that this had happened. This had been referenced as "proposed" across STATUS.md,
ARCHITECTURE.md, and the stress-test manifest for some time without ever being written into this file
as an actual guardrail — that gap is now closed.

**Why 1.0 kHz specifically is indefensible (verified against ISO 13373-2 + industry practice, 7 Jul
2026):** By Nyquist, usable analysis bandwidth is only ~0.39 × sample rate (the industry "2.56× rule":
sample rate ≥ 2.56 × Fmax). So 1.0 kHz caps analysis at ~390 Hz — far below where bearing-defect and
envelope energy live (commonly several kHz to >15 kHz for slow, large bearings). A silent 1.0 kHz
assumption on a file actually sampled at, e.g., 25.6 kHz makes every cited fault frequency wrong by
~25×, which is the single most credibility-damaging error class for an ISO-frequency-citing tool.
**There is no single "standard" default sample rate** — ISO 13373-2 dictates the rate from the maximum
frequency of interest (Fmax), not a constant. Common hardware rates are 12.8 / 25.6 / 51.2 kHz
(= 2.56 × Fmax of 5 / 10 / 20 kHz).

**Required behavior once built (resolution order — detect, then ask, then offer, always flag):**
1. AUTO-DETECT first — read sample rate from the file header, or derive it from a timestamp column's
   delta, before prompting. Many real files (incl. our own ~26.3 kHz motor-fault fixtures) already
   carry it, so a required-field prompt should be the fallback, not the first move.
2. If absent, PROMPT the user to key it in — and point them to the RIGHT source: the data-acquisition
   device / sensor or analyzer export settings (SKF, Emerson CSI, etc.), or the logger's CSV header.
   NOT the motor nameplate — sample rate is a property of the sensor/collector, not the machine; the
   nameplate carries RPM / power / frame / insulation class, not acquisition rate. (Nameplate IS the
   right pointer for RPM and, indirectly, bearing model — just never for sample rate.)
3. If still not supplied, offer a DROPDOWN keyed to analysis intent / Fmax, deriving rate at 2.56×:
     - Overall / low-speed ......... Fmax 1 kHz  → 2.56 kHz
     - General + shaft faults ...... Fmax 5 kHz  → 12.8 kHz
     - Bearing faults (default) .... Fmax 10 kHz → 25.6 kHz
     - Bearing/gear, high-freq ..... Fmax 20 kHz → 51.2 kHz
4. ANY analysis run on a value that was NOT file-detected or hand-keyed (i.e. a dropdown preset, or a
   placeholder RPM entered just to clear the form) MUST carry a visible report flag: "assumed input —
   dependent frequency citations are unverified." This is a deliberate, BOUNDED relaxation of the strict
   "no defaults" rule: a dropdown makes the assumption visible and user-chosen rather than silent, which
   is the actual harm A12 targets. Silent substitution with no flag remains forbidden. (Retroactively
   covers fixture/benchmark data lacking real nameplate values — the motor-fault manifest's own
   `nameplate.note` already states this for test data; A12 generalizes it to all input.)

**Note on the planned DATA_QUALITY sample-rate ratios (ARCHITECTURE §5):** the
`min_sample_rate_ratio_high: 20` / `medium: 10` values are ratios of sample rate to SHAFT frequency and
are an AxiomAnare HOUSE HEURISTIC for capture quality — NOT the ISO 2.56×-Fmax rule and NOT prescribed
by any standard. They're reasonable (20× shaft speed captures a healthy harmonic range) but must be
labelled as a house threshold wherever surfaced, never cited as if ISO prescribes them (per A1's spirit:
house constants and standard-derived constants must not be conflated).

**Status: CSV/generic path (`parseData()`) built and unit-verified 7 Jul 2026** — auto-detect
(header-name + median-timestamp-delta), required-field/dropdown prompt, and "assumed input" report flag
are implemented and traced end-to-end (see PART B entry below for verification detail and known gaps).
MAT path (`parseMat()`) intentionally NOT touched this session — still hardcodes 12000 Hz, logged
separately under "Deferred, not forgotten." CWRU §7 regression re-run WAS ATTEMPTED this session with a
real Puppeteer harness against real CWRU fixtures — result INCONCLUSIVE, not a pass, not a confirmed
regression (see "CWRU §7 re-run this session" entry below for full detail). Sample-rate detection itself
verified clean and unaffected; the inconclusive part is fault classification, blocked by a possible
Supabase `bearing_library` 401/RLS issue that may be pre-existing and unrelated to A12 — needs a live-app
DevTools check to resolve, not done this session. This directly corroborates the note below: the electrical/
unbalance-fallback pattern observed in the CWRU re-run IS that same pre-existing misclassification symptom,
now reproduced on-demand via the harness rather than anecdotally.

**David's explicit decision (7 Jul 2026): push A12's code (`app.js`, `index.html`) now despite §7 being
inconclusive rather than passed**, on the basis that the bearing_library issue is a separate, likely
pre-existing subsystem problem, not something A12 introduced or made worse — A12's own change (sample-rate
detection) was independently verified clean. This is a deliberate, informed call, not an oversight: DO NOT
treat this push as evidence that §7 passed, and do not let a future session assume the CWRU benchmark is
green just because this commit landed. The bearing_library 401/RLS question remains OPEN and must still be
run down (starting with the live-app DevTools Network check) as its own follow-up, independent of A12.
Related open UI bug (separate from this guardrail, but plausibly downstream of it): the fault
classification panel has shown electrical fault categories as primary while locking mechanical
categories, inconsistent with the banner text — worth re-checking once A12 lands, since unflagged
assumed inputs may be contributing to that misclassification.

---

## PART B — DECISIONS (history & rationale)

### Why CONFIG-as-data
All thresholds, classes, zone tables, and clause references live as data, not in logic — makes A1/A2
enforceable and standards correctable in one place. "Zero hardcoding in logic."

### Why a Cloudflare Worker proxy, dashboard-managed
CORS + key secrecy require a server-side proxy. It was created by pasting code into the Cloudflare
dashboard editor (the original Firefox-paste session), never linked to a local project — so there's no
`wrangler.toml` and no `wrangler deploy`. Edits happen in the dashboard.

### Why multi-tenant org-scoping (rls_foundation_v2)
Moving from a single-tool to a SaaS with paid fleet customers required real tenant isolation. The model:
profile → org_id, individual = org of one, admin sees all. Helper functions + a column-guard trigger stop
non-admins escalating their own tier/is_admin/org_id. The v2 migration closed the wide-open beta policies.
**Status: APPLIED to live DB (confirmed by policy names).**

### Why tiered subscriptions + Stripe
Free (5 analyses) → Pro $49 (unlimited) → Fleet Starter $99 (10 assets + dashboard) → Fleet Pro $299
(30 assets). Tier on `profiles.tier`, enforced server-side. Stripe billing sets tier via a service_role
webhook (exempt from RLS). [Live status of Stripe: verify.]

### Why the vib-derived electrical cap
Can't confidently diagnose electrical faults from vibration alone — capping below "Indicative" stops a
weak indirect signal outranking a direct mechanical finding.

### Why CWRU is the validation set
Published labelled ground truth; objective pass/fail independent of memory. 118_Ball is the known miss.

### Why data-quality tiering and component-replacement reset were added (19 Jun 2026)
An old (2020) third-party functional spec — unrelated vendor, unrelated system, dug up and reviewed for
ideas rather than adopted wholesale — contained two patterns worth borrowing into AxiomAnare:
1. Tiering measurements by objective acquisition quality (sample rate, duration, clipping) and excluding
   low-quality readings from trend/prognosis math while still showing them to the user (→ A10).
2. Resetting trend/RUL history on confirmed component replacement, keeping old data for audit but
   excluding it from forward-looking calculations (→ A11).
Both ideas were reviewed against AxiomAnare's actual schema and existing CONFIG-as-data convention
before being logged. Most of the rest of that spec was rejected — see PART C.
**Status: both logged as guardrails A10/A11, deliberately deferred to Phase 2. Not built.**

### Why A12 was revised to detect-then-ask-then-dropdown, and why not just "pick a better default" (7 Jul 2026)
The 1.0 kHz silent default was investigated against ISO 13373-2 and industry acquisition practice. Two
findings drove the revision: (1) 1.0 kHz isn't merely a poor default — no fixed default is defensible,
because the correct sample rate is dictated by Fmax (2.56× rule), so "swap 1.0 kHz for a better number"
would just relocate the same error. (2) Real files frequently already carry the rate (header or timestamp
delta), so auto-detection should precede any prompt. The dropdown was added as a last-resort convenience
but deliberately coupled to a mandatory "assumed input" report flag, so it can't silently reintroduce the
exact problem A12 exists to kill. Also corrected a factual error before it reached the UI: sample rate is
NOT a nameplate value (it's a sensor/collector property), so the "where to find it" guidance points at the
acquisition device, not the motor nameplate. Verified via web search of ISO 13373-2 and vendor acquisition
guidance; specific ISO clause numbers for the sample-rate text still to be pinned to CONFIG per A1 before
any figure is presented as standard-derived.

### A12 build session — what was actually implemented and verified (7 Jul 2026)
Reading the real code before writing anything surfaced a bigger picture than the original scope note:
there were **three** silent-default sites, not one — `parseData()`'s bare `sr = CONFIG.default_sample_rate_hz`
fallback (the one originally scoped), `parseMat()`'s unconditional hardcoded `sampleRate: 12000` (found
during review, NOT in original scope, logged separately under "Deferred, not forgotten" per David's
explicit instruction to leave MAT untouched this session), and the fact that `agnosticParser2.js` — named
in the original scope note as "where auto-detection logic lives" — actually has no sample-rate detection
of its own for CSV/TSV/XLSX/JSON/TXT; that logic lives in `app.js`'s `parseData()`. Built against the real
location, not the assumed one.

**Implemented in `parseData()`:** two-strategy detection returning `{sampleRate, sampleRateSource}` instead
of a bare always-populated number — (a) header/field-name match (`sample_rate`, `fs`, `sampling_frequency`,
`SampleRate`, case/whitespace-insensitive) on a near-constant numeric column; (b) timestamp-column
**median**-of-deltas (upgraded from the prior single two-row `ts[1]-ts[0]` delta, which is what the old
code actually did — not a true median as A12 specifies). Returns `sampleRateSource: null` when neither
strategy succeeds — this null is what lets the resolution layer distinguish "genuinely unknown" from
"detected," which the old code could not do (a bare number is indistinguishable from a defaulted one).

**Implemented in `runPipeline()`:** resolution priority hand-keyed exact value → detected (header/timestamp)
→ dropdown preset → quarantine-and-prompt. `machineParams.sampleRateIsPreset` (new field, set by
`readMachineParams()`) distinguishes a hand-typed number from a dropdown-selected preset, since both land
in `declaredSampleRate` but only the preset path is meant to carry the "assumed input" flag. Quarantine
path calls new `requireSampleRateInput()`, which opens Step 2, focuses the field, and shows a required-
field note — no run proceeds past this point without a value from *some* source.

**Implemented in `index.html`:** Sampling Rate field copy corrected (removed "default 12000" framing;
points to acquisition device/analyser export/CSV header, not nameplate, per the earlier A12 revision);
added the four-option Fmax-keyed preset dropdown (`#p-sample-rate-preset`) per spec; added
`#sample-rate-required-note` and `#sample-rate-banner` elements. The assumed-input banner was deliberately
given its own CSS class (`.sample-rate-banner`, not `.data-banner-*`) because the print stylesheet has a
blanket `.data-banner{display:none}` rule — the assumed-input flag must survive to printed/exported
reports, not just the on-screen view, or the flag defeats its own purpose the moment someone prints a PDF.

**Verified (evidence, not assertion):** wrote a synthetic ~26.3 kHz timestamp-column fixture with injected
jitter on every 137th row specifically to test that median (not mean, not first-delta) resists outliers;
extracted and ran `parseData()` standalone against it — resolved to 26,302 Hz, source `'timestamp'`. Also
verified a header-based `sample_rate` column resolves correctly and takes priority over timestamp per the
spec's strategy order, and — the actual regression this whole guardrail exists to prevent — verified a
file with **neither** signal now returns `sampleRate: null, sampleRateSource: null` rather than silently
returning `1000`. Separately simulated all six resolution-priority branches (hand-keyed alone, header alone,
timestamp alone, hand-keyed overriding a detected file value, preset-only, and nothing-at-all) and confirmed
the "assumed" flag fires on exactly the preset branch and never on any other, and that the nothing-at-all
case quarantines rather than defaulting. `node --check app.js` clean after all edits.

**NOT done this session, left open:** CWRU §7 benchmark regression re-run — no harness or fixture files
were available in this session; per DEPLOY_CHECKLIST this must run and pass (or this must be reverted)
before A12 is considered shippable. CONTEXT.md — referenced in the original session scope note as a
closing-step file to update, but was not among the uploaded project files and its relationship to the
existing four-file system (ARCHITECTURE/STATUS/DECISIONS/DEPLOY_CHECKLIST) was not resolved this session;
raised with David, no preference given, left as an open question rather than guessed at. Nothing has been
committed/pushed — all edits exist only in this session's working copy pending David's review.

### Why the color scheme moved from dark navy to cream/light (6 Jul 2026)
Cosmetic UI decision, not a data or pipeline change. Motivated by comparing an externally-built (other
platform) mockup that used a light, minimal SaaS aesthetic — David liked that layout/color direction and
asked for it to be adopted using AxiomAnare's own real design tokens, not the other tool's. Converted the
16 `:root` variables plus the hardcoded literal colors found duplicating them (see PART C entry below).
Explicitly scoped as cosmetic only — no process, pipeline, or backend logic was touched.

### [ADD future decisions here — date, what, why]

---

## PART C — KNOWN PAST PITFALLS
- AI report over-citing → mitigated by A1; still verify the constants.
- Pushing to `main` / testing in production → use DEPLOY_CHECKLIST; branch for risky work.
- Windows Git Bash: patch with `node script.js`, not heredoc / `python3 -c`.
- Silent JS syntax error → `node --check app.js` before pushing.
- `.wrangler/` cache committed → in `.gitignore`; keep it there.
- Re-opening RLS to `USING (true)` to unblock something → never; fix the auth path (A8).
- Destructive SQL with no backup on Free tier → export first (A9).
- Drive/machine drift (D: office, E: home) → paths vary; don't hardcode one.
- **Color variable governance drift (found 6 Jul 2026):** despite CSS variables existing for exactly
  this purpose, index.html accumulated 43 hardcoded hex literals and 71 hardcoded rgba() literals over
  time, several of them near-duplicate colors of the real variables (three different "greens" were in
  simultaneous use: `--green`, a separate value in `.mgmt-card.green`, and a third in the print
  stylesheet). Values were reconciled during the 6 Jul theme conversion, but the literals still aren't
  wired to `var()` — a future edit to a variable won't propagate to them. Don't repeat the pattern:
  always reuse `var(--x)`, never hardcode a color that already has a named variable.
- **Stale saved Project Instructions draft:** a draft containing `esimconnect`, "2 analyses," and a
  10-item CSS variable list has been pasted into chat multiple times across sessions despite being
  corrected each time. It is not being edited between pastes — it's a static saved snippet. Delete it
  rather than keep re-flagging it.
- **Re-uploading an older DECISIONS.md as if it were current** (6 Jul 2026): a version missing A10, A11,
  and the Part C rejected-patterns log was uploaded after those had already been added in the 19 Jun
  session. Always check "last updated" context against the live project state before treating an
  upload as authoritative — an upload is not automatically newer than what's already established.
- **A guardrail referenced before it's written:** A12 was cited as "proposed" in STATUS.md,
  ARCHITECTURE.md, and the stress-test manifest for an extended period before actually being added to
  this file. If a decision is real enough to reference elsewhere, write it into DECISIONS.md the same
  session — don't let a citation outlive its source.

### Patterns explicitly REJECTED from the old third-party spec review (19 Jun 2026)
Reviewed and consciously NOT adopted — logged so they don't get reinvented worse later if anyone
references that document again:
- **Single-tenant-per-client deployment** ("a new deployment is required when new clients are added").
  Directly opposite to AxiomAnare's org-scoped multi-tenant RLS model (A8). Do not import this.
- **Self-calibrating sensor hardware requirement** — not applicable; AxiomAnare doesn't own sensor
  hardware, only processes uploaded files.
- **Three-tier RBAC (Admin / Advanced / Common user)** — AxiomAnare's current model is binary
  (`is_admin` or not). Noted as a *possible* future pattern if Fleet customers want sub-roles within
  their own org, but NOT to be built speculatively — consistent with the project's tight scope control.

### Deferred, not forgotten (open items with an explicit "not now")
- **Emoji cleanup in the UI** (17 instances found 6 Jul 2026) — violates the documented "no emojis in
  diagnostic output" standard. David explicitly asked to leave these until after current heavy-lift work
  is done, then do a housekeeping pass. This is a deliberate sequencing decision, not an oversight — do
  not "helpfully" fix it early, and do not let it silently drop off the list either.
- **`parseMat()` hardcodes `sampleRate: 12000` for every .mat file, no detection attempted** (found 7 Jul
  2026, during A12 build). This is a second silent sample-rate default, structurally the same class of
  bug A12 was written to kill, sitting outside A12's originally scoped fix (which targets the CSV/generic
  `parseData()` path only). Not all CWRU-style .mat files are actually 12 kHz (some CWRU DE channels are
  48 kHz) — so this is a real, live inaccuracy risk, not a hypothetical one, and arguably worse than the
  old 1.0 kHz CSV default because 12 kHz "looks" plausible and is less likely to be caught by inspection.
  Explicitly deferred at David's direction: A12 this session covers CSV/timestamp detection only; the MAT
  path is left as-is intentionally, not by oversight. Follow-up needed later: detect from a time-vector or
  RPM variable if present in the .mat file's own arrays, else route through the same prompt/dropdown/flag
  path A12 builds for CSV. Do not let this silently drop off the list.
- **Parser scope vs. target audience — needs a dedicated scoping session** (raised 7 Jul 2026). Confirmed
  design intent: AxiomAnare targets companies that already own portable/permanent vibration DAQ hardware
  but lack in-house vibration engineers and analytic software — i.e. non-specialist users handing off
  vendor-exported files for interpretation, not raw-acquisition-layer users. This likely means format
  *container* breadth (TDMS/UFF/native binaries) matters less than making sure a non-specialist actually
  exports RAW time-waveform (not a processed summary/trend/alarm log) from their vendor software before
  upload — wrong export = unusable input regardless of parser quality. Not resolved or built this session;
  explicitly deferred to its own future session, not decided by default. See chat history 7 Jul 2026 for
  the full reasoning (CWRU-as-benchmark-not-representativeness discussion, Tier 1/2/3 vendor hardware
  breakdown, sensor-model-does-not-determine-sample-rate finding).
- **Second real-data source for the vibration benchmark (raised 7 Jul 2026)** — CWRU is a single-rig
  benchmark; a second independent real dataset would test whether AxiomAnare's classification generalizes
  beyond CWRU's specific sensor/mounting characteristics rather than being overfit to it. Checked past
  history: NASA IMS bearing data WAS used before, but as WAV audio conversions for AxiomSensa's acoustic
  pipeline — wrong format and wrong project for AxiomAnare's vibration/FFT path. No IMS data currently
  exists in AxiomAnare's expected shape (timestamp + acceleration column, CSV/mat). A "Nasa_Data_Set.zip"
  uploaded this session turned out to be NASA C-MAPSS turbofan RUL data (26-column multi-sensor engine
  degradation, cycle-indexed) — a different problem type (RUL regression, non-vibration sensors) and
  explicitly NOT used; would have been a shape-mismatched benchmark if forced in. Real candidates already
  vetted in past history and worth pursuing later: NASA IMS (needs fresh raw download + conversion to
  AxiomAnare's CSV shape, the WAV conversions are not reusable), MFPT, and FEMTO-ST/PRONOSTIA (run-to-
  failure, multiple operating conditions). Not built this session — deferred, not decided against.

### bearing_library 401 — RESOLVED: local test-environment artifact, not a live bug (7 Jul 2026)
Follow-up to the CWRU §7 entry below. Checked the live deployed app directly per that entry's own
instruction: opened `https://kairosaxiom.github.io/AxiomAnare/` (note — NOT `esimconnect.github.io`,
which is legacy and was supposed to have been cleared out; STATUS.md's "Live" anchor line still needs
fixing to match, see Next tasks), DevTools → Network tab, filtered on `bearing_library`, ran a real
analysis. Both calls returned a clean **200**:
- `bearing_library?select=model,bpfo_mult,bpfi_mult,bsf_mult,ftf_mult&order=model` (from `initBearingLibrary()`, app.js:861) — 200, 1.1kB
- `bearing_library?limit=1` (the keep-alive ping, app.js:108) — 200, 1.0kB

**Conclusion: this is NOT a live production bug.** No users are getting silently degraded bearing-fault
diagnoses. The 401 seen during last session's `cwru_benchmark.js` run was an artifact of the test
environment it ran in — most likely a network-restricted sandbox blocking `supabase.co` (the harness's
own header comment already warned this is possible: "if those are blocked, as they are in some sandboxed
CI environments..."), not a real difference between `file://` and the live origin. Anon-key Supabase REST
calls are origin-agnostic by design, which the clean 200/200 result above confirms directly.

**Side finding, not a bug:** the query selects a `model` column and it works live — but `axiomanare_schema.sql`
in this repo defines the column as `bearing_model`. The live DB and the repo's schema file have drifted;
the SQL file is stale documentation, not a bug in the running app. Low priority, but worth reconciling
next time schema work is touched, so the file stops being misleading.

**No code change needed for the 401 itself.** `cwru_benchmark.js` does not need its `file://` navigation
changed — re-run it from a machine with real, unrestricted network access (not a sandboxed CI/AI
environment) and it should now produce a real, clean §7 result. One caveat worth knowing before re-running:
`nvr_records` and `fault_detections` both carry anon-insert policies, so each harness run — via `file://`
or the live URL — writes 5 real rows into production tables. Not a blocker, just don't be surprised by
accumulating test rows there.

### CWRU §7 re-run this session — INCONCLUSIVE, not a pass, not a confirmed regression (7 Jul 2026)
Built `cwru_benchmark.js`, a real-headless-Chrome (Puppeteer) harness that drives the actual live
`index.html`/`app.js` end to end — uploads each CWRU fixture through the real file input, clicks the real
Analyse button, reads real rendered DOM values. Two harness bugs were found and fixed during the first
real run (both harness-side, not app bugs): (1) Step 2's machine-parameter panel is a collapsed accordion —
`#p-rpm` exists in the DOM but isn't clickable until `#param-toggle` expands it; the harness was clicking it
directly and failing. (2) Machine class (Step 1) must be selected before analysis or zone thresholds are
undefined; the harness was skipping this step entirely. Both fixed; harness now mechanically works
(verified: class selection, accordion expand, and field input all confirmed against the real page).

**After the fix, the run completed on all 5 fixtures but produced a result that should NOT be read as a
clean CWRU pass, and should NOT be read as an A12 regression either — it's genuinely unresolved:**
- Every run hit a `401` on some resource, plus a separate (already-understood, unrelated) CORS rejection
  on the `restless-tree-eac8.../embed` Worker call (origin-guarded to `esimconnect.github.io`; a `file://`
  test origin will always fail that check — expected, not a new finding).
- None of the 5 runs produced a bearing-specific fault category (no Inner Race, Outer Race, or Rolling
  Element) — all 5 fell back to "Mechanical Unbalance" or "Electrical - Rotor Bar", categories that don't
  require bearing constants.
- Root cause hypothesis (NOT CONFIRMED): `initBearingLibrary()` in `app.js` (~line 891) fetches
  `bearing_library` from Supabase using the public anon key: if the fetch fails (`!res.ok`), the function
  silently no-ops — `window.BEARING_LIBRARY` is simply never set, no error surfaced anywhere. This is a
  second silent-failure pattern, same family as the sample-rate default A12 targets, in a different
  subsystem. If the 401 seen in this test run is this exact call, that would fully explain the observed
  fallback-only classification pattern.
- **Genuinely unresolved: is this a live production bug, or an artifact of testing from a local `file://`
  origin?** Reasoned through without a confirmed answer — anon-key Supabase REST calls are typically
  origin-agnostic (unlike the custom origin-check on the Cloudflare Worker), which leans toward "local
  artifact," but recent RLS-tightening work on this project (see STATUS.md's own long-standing open
  verification item re: org-scoped RLS possibly rejecting logged-out `nvr_records` writes) means a
  similar tightening on `bearing_library`'s anon-read policy is a real possibility, not ruled out.
  **Needs a DevTools Network-tab check on the actual live deployed app to resolve** — not done this
  session, David deferred it explicitly rather than have it guessed at.
- Separately, the harness's `kpiZone` extraction (`#kpi-zone`) was found to read a stale/never-populated
  placeholder element — the real zone data lives in `#zone-desc` / `#zone-iso-clause` / the `.zone-seg`
  element carrying the `current` class. Fixed in the harness to read the real elements; flagged here in
  case `#kpi-zone` is genuinely dead markup worth removing in a future cleanup pass (not touched this
  session — out of scope for A12).

**Bottom line: A12's own changes (sample-rate detection) were NOT implicated in any of the above — the
detection logic itself was separately verified clean against these same 5 real fixtures (see the A12 build
entry above: old vs. new sample-rate logic produced identical 12,048 Hz on all 5 files). But §7's actual
pass/fail sign-off could not be completed this session, because the bearing-library 401 makes the
fault-classification portion of the benchmark unreadable independent of anything A12 touched. Do not mark
§7 "passed" on the basis of this run. Do not mark it "regressed" either — the fallback pattern is equally
consistent with a pre-existing, A12-unrelated Supabase/RLS issue as with a local test-environment artifact.
Re-run needed, either against the live deployed app directly, or after resolving the anon-read 401 locally.

**UPDATE, same day:** resolved — see "bearing_library 401 — RESOLVED" entry above. Live app confirmed
clean (200/200 via DevTools). Not an A12-related regression, not a live bug. §7 itself still needs an
actual clean re-run of `cwru_benchmark.js` from a machine with real network access to get a real pass/fail.
