# LynxEyes — DECISIONS & GUARDRAILS

> The *why* behind the project, and the rules that keep the analysis honest.
> READ PART A every session before touching diagnostic or report logic.

---

## PART A — GUARDRAILS (active rules)

### A1. ISO clause references come from CONFIG only — never invented
Every clause reference is a stored CONFIG constant (per fault rule, zone, trend). The AI report prompt
carries an explicit ANTI-HALLUCINATION block: use ONLY values from the machine's record, cite ONLY ISO
clauses already in that record. The AI quotes constants, it does not freelance citations.
**So the risk is a wrong constant, not runtime hallucination — fixable in one place.**
⚠️ OPEN (updated 21 Jul 2026): **ISO 10816-3 verified against the published 2009(E) standard and
CORRECTED** — the fabricated `Table 1 S5.x` clauses and the wrong zone boundary VALUES (4/5 classes) were
fixed in CONFIG (see Part B, "ISO ringfence integrity audit"). Still to verify: ISO 13379-1, 13373-1,
13373-2, 13381-1, 55001 and IEC 60034-14 — all still carry the suspect `Sx.x` notation and have NOT been
checked against their real clause structure. Same option-(a) method when done (cite only to the verifiable
level — annex/clause — never an invented decimal).
⚠️ OPEN (added 3 Sep 2026): **ISO edition check.** The zone table was verified against ISO 10816-3:2009(E),
but ISO 20816-3:2022 has since replaced 10816-3 and its zone boundaries / group definitions were revised.
Decide whether LynxEyes stays on the 2009 edition (acceptable, but must be labelled as such in the UI and
report) or migrates CONFIG to 20816-3 values — a migration changes classification output → CWRU re-run
(A6). Surfaced by the MechEyes/Gemini transcript review (Part B, 3 Sep 2026), which cited 20816-3.

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
are a LynxEyes HOUSE HEURISTIC for capture quality — NOT the ISO 2.56×-Fmax rule and NOT prescribed
by any standard. They're reasonable (20× shaft speed captures a healthy harmonic range) but must be
labelled as a house threshold wherever surfaced, never cited as if ISO prescribes them (per A1's spirit:
house constants and standard-derived constants must not be conflated).

**UI pattern for step 2 (added 3 Sep 2026):** when prompting, show what WAS detected alongside what is
missing, e.g. "Detected 40,960 samples at 10 kHz. Enter the motor's nominal RPM to enable fault-frequency
mapping." Stating the detected values (a) proves the file was read, (b) lets the user sanity-check the
auto-detection at the same moment, and (c) keeps the free-tier flow moving with one field rather than a
form. Borrowed from the MechEyes transcript review (Part B, 3 Sep 2026).

**Status: not yet implemented.** Related open UI bug (separate from this guardrail, but plausibly
downstream of it): the fault classification panel has shown electrical fault categories as primary while
locking mechanical categories, inconsistent with the banner text — worth re-checking once A12 lands,
since unflagged assumed inputs may be contributing to that misclassification.

### A13. Two-tier output model — severity confident, bearing fault type indicative (formalised 2 Sep 2026)

The diagnostic output is structured into two tiers with different confidence levels.
This is NOT a hedge on severity — it is an honest representation of what single-file
analysis can and cannot determine.

**Tier 1 — Severity (always stated with full confidence):**
ISO zone from RMS velocity vs ISO 10816-3 boundaries is an objective measurement.
Zone D = act now. Zone C = schedule urgently. This never gets hedged.
The zone drives urgency and required action regardless of fault type confidence.

**Tier 2 — Fault type (confidence proportional to detection method):**
- Shaft-synchronous faults (unbalance, misalignment, looseness): detected from
  raw FFT peak ratios — reliable from a single file. State as "likely driver"
  when confidence ≥ 20%. Confident language is appropriate.
- Bearing faults (BPFO, BPFI, BSF, FTF): detected via envelope BER + direct
  FFT BER. ALWAYS state as "indicative only" on a single reading. Single-file
  analysis cannot confirm bearing fault type without resonance frequency
  knowledge — real hardware analysers solve this with sensor-housing resonance
  data that a software upload tool does not have.
  Confident bearing identification requires trend over multiple readings
  (CF + kurtosis rising consistently over time).

**Single-reading caveat:** Zone C/D from a single file without trend history
appends a note that re-measurement is recommended before a shutdown decision.
The severity is real; one file cannot rule out a transient.

**Implementation:**
- plainFaultText(): bearing faults → "Signal activity at [freq]. Indicative — inspect bearing."
- Management summary card: bearing-only indicative in Zone A/B → soft language,
  no inspection urgency. Zone C/D → zone drives urgency, bearing type hedged.
- buildFallback fA: all four bearing types → "INDICATIVE ONLY — single-file
  envelope analysis cannot confirm bearing fault type."
- Short-term action for bearing: "Inspect only if trend confirms deterioration."
- AI prompt: TWO-TIER OUTPUT MODEL section + revised anti-hallucination rules.

**CWRU benchmark acceptance bar (updated, replaces "5/5 confident ID" bar):**
Per Smith & Randall (2015): some CWRU records are undiagnosable by any method.
Ball faults are the hardest category. The "5/5 confident identification" bar
was wrong — it would have required over-diagnosis, violating A2/A3.
Correct bar:
  - Normal: Zone A/B, no confident fault. ✓
  - IR_007 / OR_007 / OR_021: correct bearing category elevated, indicative language. ✓
  - Ball_007: hedge/indicative is the correct and acceptable output. ✓
Status: IMPLEMENTED and verified live (bac213c, 2 Sep 2026).

### A14. Fault-frequency multipliers anchor to the MEASURED 1×, not nameplate RPM (formalised 3 Sep 2026, not yet built)
Nameplate RPM is the starting point, never the anchor. Motors run below synchronous speed under load
(a "1500 RPM" motor may run 1475 loaded, 1492 idling); if 2×/3× harmonics and BPFO/BPFI/BSF/FTF markers
are computed from nameplate, the bearing markers drift out of their search windows and the scorer misses
or mis-bins them.
**Required behaviour once built:**
1. Search for the dominant peak inside a NARROW window around the nameplate-derived shaft frequency
   (CONFIG constant — proposed ±5% for direct-drive; for induction motors the window can be tighter,
   bounded by synchronous speed above and full-load slip below). NEVER "take the highest peak in the
   low-frequency spectrum" — that is frequently 2×line, blade-pass or gearmesh, not 1×.
2. If a peak is found in the window, use it as the measured 1× and derive every multiplier from it.
   Surface it: "Measured running speed 1476 RPM (nameplate 1500)."
3. If no clear peak is found (flat window, or peak below a CONFIG prominence threshold), fall back to
   nameplate AND flag it under the A12 assumptions note ("running speed not detected — fault frequencies
   derived from nameplate RPM").
4. Measured-vs-nameplate deviation beyond a CONFIG bound (proposed >5%) is itself a data-quality flag
   (A10) — either the nameplate RPM is wrong or the wrong peak was picked.
**Status: not yet implemented.** Small scorer change; belongs with Phase 1.5 accuracy work. CWRU re-run
required after (A6). Origin: MechEyes/Gemini transcript review, Part B, 3 Sep 2026.

### A15. Spectral-resolution guard — window in BINS, warn on coarse Δf (formalised 3 Sep 2026, not yet built)
Frequency resolution Δf = fs / N (N = FFT/segment length) determines whether the engine can see what it
claims to look for. Peak-search windows expressed in fixed Hz can contain ZERO bins when Δf is coarse
(e.g. a ±1 Hz window with Δf = 2.44 Hz — the exact failure that made the MechEyes reference code miss a
pure 50 Hz sine). Sideband detection (slip sidebands at ±2·s·f_line, bearing modulation) needs Δf well
below the sideband spacing.
**Required behaviour once built:**
1. Compute and store Δf for every analysis; expose it in the assumptions/quality note.
2. All peak-search and band-energy windows are sized in bins (minimum 1 bin either side), derived from
   the Hz tolerance in CONFIG — never a raw Hz range that can round to nothing.
3. Record-length check: capture must contain ≥ CONFIG minimum shaft revolutions (house heuristic,
   proposed 20) for the 1× estimate and harmonic ratios to be trusted; fewer → A10 data-quality
   downgrade, not a silent result.
4. If Δf is too coarse for a given check (CONFIG threshold per check — proposed 0.5 Hz for sideband
   logic), that check is reported as "not resolvable at this record length", NOT run and reported
   as "absent". Absence of evidence must never be manufactured by resolution.
These are LynxEyes house thresholds, not ISO-prescribed — label accordingly per A1/A12.
**Status: not yet implemented.** Feeds the Phase 1.5 "odd sample rates / robustness" item. Origin:
MechEyes/Gemini transcript review, Part B, 3 Sep 2026.

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
ideas rather than adopted wholesale — contained two patterns worth borrowing into LynxEyes:
1. Tiering measurements by objective acquisition quality (sample rate, duration, clipping) and excluding
   low-quality readings from trend/prognosis math while still showing them to the user (→ A10).
2. Resetting trend/RUL history on confirmed component replacement, keeping old data for audit but
   excluding it from forward-looking calculations (→ A11).
Both ideas were reviewed against LynxEyes' actual schema and existing CONFIG-as-data convention
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

### Why the two-tier output model was adopted (2 Sep 2026)
A mid-session strategic review identified that the engine was reliable on
severity (ISO zone from RMS velocity) but was chasing an unreachable bar on
confident bearing fault type from a single file. Real hardware analysers
(SKF @ptitude, Emerson AMS, CSI) solve bearing detection with hardware-level
resonance knowledge — they know the structural resonance frequency of their own
sensor housing. LynxEyes processes uploaded files without that knowledge.

The CWRU 0.007" early-stage bearing faults produce modest envelope BERs in the
1.2–2.8 range, which is at the edge of what software-only analysis can
discriminate. Attempting to reach "5/5 confident identification" on these files
required progressively loosening the scoring thresholds in ways that would
over-diagnose on healthy machines — directly violating A2 and A3.

The two-tier model resolves this honestly: severity is always confident (it is
an objective ISO measurement), fault type confidence is proportional to the
detection method's actual reliability. This is more credible than over-stating
bearing confidence, more useful than refusing to say anything, and more honest
than any alternative.

Bearing fault identification will improve as customers accumulate trend data
(CF + kurtosis rising over multiple readings is a reliable signal). The fleet
dashboard and trend history enable this path — it is a Phase 2 improvement, not
a pre-launch requirement.

### Why the color scheme moved from dark navy to cream/light (6 Jul 2026)
Cosmetic UI decision, not a data or pipeline change. Motivated by comparing an externally-built (other
platform) mockup that used a light, minimal SaaS aesthetic — David liked that layout/color direction and
asked for it to be adopted using LynxEyes' own real design tokens, not the other tool's. Converted the
16 `:root` variables plus the hardcoded literal colors found duplicating them (see PART C entry below).
Explicitly scoped as cosmetic only — no process, pipeline, or backend logic was touched.

### Why the repo, local folders, and Supabase ref kept the AxiomAnare name after the LynxEyes rebrand (20 Jul 2026)
The product rebranded AxiomAnare → **LynxEyes** (trademark + domain lynxeye.io cleared first). The rebrand
was scoped as **display-name-only**, following the earlier esimconnect → Juzgo precedent, which was also a
display-name change (same repo, same Supabase project ref, only the human-readable label flipped).
Deliberately NOT renamed, because each is invisible to users and renaming risks breaking live state for
zero user benefit:
- **GitHub repo** stays `AxiomAnare` (live URL `kairosaxiom.github.io/AxiomAnare`). Renaming would change
  the URL and require updating every hardcoded link; a custom domain (lynxeye.io) would make the repo name
  moot anyway, so it's deferred to if/when that domain is wired up.
- **Local disk folders** stay `AxiomAnare` — they track the *repo* (git uses `.git/config` remote, not the
  folder name), and CONTEXT/ARCHITECTURE document those exact paths across two machines (D: office /
  E: home). Renaming folders would re-introduce doc drift and break `cd` habits/scripts. The triple-nesting
  `AxiomAnare\axiomanare\AxiomAnare` is a harmless clone artifact — only a fresh re-clone would flatten it,
  which is a separate deliberate task, not bundled with a rename.
- **Supabase project ref** `zjfhxutcvjxootoekade` is immutable — only the dashboard *display label* was
  renamed to LynxEyes. Anon key, URL, RLS, connection strings all key off the ref, not the label.
- **Cloudflare worker** `restless-tree-eac8` unchanged — worker names are invisible and `PROXY_BASE` +
  the Stripe webhook depend on it.
**The point:** brand-facing surfaces became LynxEyes; private plumbing kept the AxiomAnare name so the repo,
folders, and ref all still agree with each other. The naming mismatch (product ≠ repo/folders) is
intentional and documented — see CONTEXT.md → Repository section for the one-line map.

### Why input assumptions are now surfaced, not silently defaulted (21 Jul 2026)
A12's "no silent defaults" principle was generalised beyond sample rate to every value the engine assumes
when the user doesn't supply it. The parser (`agnosticParser2.js`) now publishes a `window.AG.assumptions`
contract; `app.js` merges it with its own sample-rate provenance into a single consolidated "Analysis
Assumptions" note that appears (a) on screen, (b) on printed/exported reports, and (c) as DATA QUALITY
FLAGS in the AI prompt — so the report itself qualifies its language and the user can correct any wrong
assumption in Step 2 and re-run. Four assumption types are surfaced: guessed unit, approximate conversion,
vendor-default sample rate, preset sample rate. Confident inputs (name-matched unit, file-detected or
hand-keyed sample rate) produce no note.
- **Decision — unit guesses run-with-note, not quarantine.** Unlike a missing sample rate (which A12
  quarantines), an inferred unit always has a defensible best guess; blocking every unlabelled-unit file
  would gut the agnostic value proposition. The note is the safety mechanism; silent substitution remains
  forbidden. A surfaced, correctable assumption is the bounded relaxation.
- **Bug fixed en route — U_PAT word-boundary.** Unit-name detection used `\b` boundaries, but underscore is
  a regex word character, so the commonest real column names (`velocity_mm_s`, `accel_g`, `vibration_mmps`)
  NEVER matched and fell through to the amplitude-range GUESS — mislabelling units on most underscore-named
  files and, when wrong, corrupting the ISO velocity zone. Fixed with the same letter-only lookaround
  already applied to FS_PAT/TIME_PAT. Effect: the assumptions note now fires far LESS often (correct matches
  instead of guesses). Verified against a match + non-false-positive suite (`g` still rejects
  gap/gear/avg/range).

### ISO ringfence integrity audit — mechanism sound, constants wrong (21 Jul 2026)
Audited the anti-hallucination ringfence (A1) end-to-end. **The mechanism is intact**: the Cloudflare Worker
is a pure pass-through (never touches prompt or response), CONFIG-as-data holds, the anti-hallucination
prompt block is enforced, and RAG/KB context is fenced separately from ISO citations. So the model is not
free-hallucinating — it faithfully cites the stored constants. **The risk is therefore a wrong constant,
exactly as A1 predicted — and several were found.**

**ISO 10816-3 zone table — CORRECTED (verified against ISO 10816-3:2009(E)).** Two classes of defect, both
fixed in `app.js` CONFIG `iso_severity_zones`:
1. *Fabricated citations.* `ISO 10816-3:2009 Table 1 S5.1..S5.4` does not exist in the standard. Real
   structure: **Table A.1** (Group 1, large >300 kW) and **Table A.2** (Group 2, medium 15–300 kW), each
   split Rigid/Flexible; zones A/B/C/D are table ROWS, not `Sx.x` sub-clauses. Corrected to
   "Table A.1/A.2 (Group N, Rigid/Flexible), Zone X" — cited only to the verifiable level (option (a): no
   invented decimals).
2. *Wrong boundary VALUES on 4 of 5 classes* — the more serious finding, because a wrong boundary
   mis-classifies a machine's zone (a real diagnostic error, not just an uncheckable citation). Corrected to
   the published Table A.1/A.2 velocity values (mm/s r.m.s., A/B · B/C · C/D):
     - Group 1 Rigid 2.3·4.5·7.1   ·   Group 1 Flexible 3.5·7.1·11.0
     - Group 2 Rigid 1.4·2.8·4.5   ·   Group 2 Flexible 2.3·4.5·7.1
   Class→Group mapping: cls_ii→G2 Rigid, cls_ii_f→G2 Flex, cls_iii→G1 Rigid, cls_iv→G1 Flex. The corrected
   boundaries are **stricter** than the old ones — some existing readings will shift up a zone. This is a
   correction, not a regression, but it changes diagnostic output → **CWRU re-run required (A6).**

**cls_i ("Class I", ≤15 kW) — kept, but flagged honestly.** ≤15 kW is outside ISO 10816-3's scope entirely;
its 0.71/1.8/4.5 bands are **ISO 2372:1974 Class I** (withdrawn 1995). Values kept per decision this session,
but the citation was corrected from a false "ISO 10816-3" to "ISO 2372:1974 Class I (legacy — outside ISO
10816-3 scope)", and the class label to "Class I (legacy)", so the ringfence no longer misattributes the
source. Revisit whether to migrate small machines onto a proper ISO 20816 basis later.

**Verified via zone-lookup test:** the corrected table reproduces the standard's own worked examples (e.g.
Group 2 rigid pump @ 5.0 mm/s → Zone D). All checks pass. NOTE: zone *logic* verified in isolation; the
CWRU benchmark (A6) is the required gate before this reaches `main`, since the value changes alter scoring.

**Still open (see A1):** ISO 13379-1, 13373-1/2, 13381-1, 55001, IEC 60034-14 all still carry the suspect
`Sx.x` notation and were NOT corrected this session — deferred to a follow-up pass, same option-(a) method.

**Recommended companion (not yet done):** add one explicit line to the AI prompt KB block — "these excerpts
are background only; never cite them as ISO/IEC clauses" — to harden the Layer-1/Layer-2 boundary from
implicit (currently only Rule 4) to explicit.

### Why the product name is LynxEyes (plural), corrected 7 Aug 2026
The intended product name is **LynxEyes** (plural). The earlier singular "LynxEye" used in the 20 Jul
rebrand was an error, not a deliberate choice — corrected here so the singular doesn't resurface as
confusion later (the way esimconnect did). Scope of the correction, following the SAME display-name-only
discipline as the 20 Jul rebrand:
- **Display name + UI text only.** index.html / app.js / fleet.html / admin.html prose, titles, print
  headers/footers, the AI persona ("LynxEyes Assist"), RAG-prompt product name, watermark. Committed as
  `fe16898`.
- **Nav logo swapped** from the animated eye+gears SVG to a raster **lynx-head lockup** (head + "LynxEyes"
  wordmark + "Predictive Condition Monitoring" tagline), Layout A — the full image replaces the old
  SVG-mark + HTML-wordmark + two mono taglines. New files `lynxeyes-logo.png` (nav) and
  `lynxeyes-favicon.png` (head crop); the old `lynxeye-logo-static.svg` favicon reference is retired
  (file left in repo, now unreferenced).
- **Tagline adopted** ("Predictive Condition Monitoring"), replacing the two prior mono taglines.
- **Interim visual debt (accepted, logged):** the lockup is teal/green on a blue app, and the wordmark is
  now baked pixels (softens slightly on retina, can't be restyled via CSS). This was a knowing trade-off
  to ship the name correction now; swap in a true **blue vector** later — that's a clean one-file change.
  The animated-SVG nav logo is retired (not kept elsewhere unless we deliberately re-add it).
- **Domain:** `lynxeye.io` (singular) kept for now; `lynxeyes.io` (plural) being acquired. If/when the
  plural domain is wired, the usual follow-ups apply (Supabase Auth redirect allow-list, Worker CORS,
  Stripe success/cancel URLs).
- **NOT touched** (same reasons as 20 Jul): GitHub repo + live URL (`kairosaxiom.github.io/AxiomAnare`),
  local folders, Supabase ref `zjfhxutcvjxootoekade`, worker `restless-tree-eac8`, `ax_*` localStorage
  keys, `axiomPrint()`, filenames `axiomanare_*`. The product≠repo naming mismatch is still intentional —
  now product = **LynxEyes** (plural), repo/folders = AxiomAnare.

### Why the MechEyes (Gemini) transcript was reviewed, and what was borrowed vs rejected (3 Sep 2026)
David ran a parallel design conversation with Gemini — steering it toward the same problem LynxEyes
solves — and saved the transcript as `MechEyes.md`, to test whether an independent route reached anything
LynxEyes lacks. Same discipline as the 19 Jun third-party spec review: dig for ideas, adopt only what
survives comparison with the live engine, log the rejects so they don't get reinvented.

**Verdict:** the transcript is a competent textbook outline of the standard vibration-diagnostic
approach (normalise → features → physics rules → ML), which independently confirms LynxEyes' architecture
is the conventional one. Its reference implementation, however, fails its own synthetic test (a clean
50 Hz sine at 3000 RPM produced "Electrical_Anomaly: 75%" and NO 1× detection) and has structural gaps
LynxEyes already closed: no units/integration path to ISO velocity, single-channel schema, no envelope
analysis, bearing rule with no frequency check, and pseudo-percentage confidences — the precise
over-diagnosis A13 retired. Nothing in it competes with what is live.

**Borrowed (→ Part A):**
1. Measured-1× anchoring for fault multipliers → **A14**.
2. Spectral-resolution guard (bins not Hz, Δf and record-length checks) → **A15**.
3. "Show detected, ask for missing" prompt pattern → **A12 addendum**.
4. ISO 20816-3 vs 10816-3 edition question → **A1 open item**.
**Parked (→ Part C, deferred):** MCSA current-channel cross-validation; UFF/UNV (Type 58) import.
**Rejected (→ Part C, rejected patterns):** energy-ratio unbalance rule, kurtosis-only bearing rule,
arbitrary confidence arithmetic, flat JSON rule schema, early ML with SMOTE on CWRU.

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
- **Naming mismatch is INTENTIONAL, don't "fix" it:** product = LynxEyes, but repo + local folders +
  Supabase ref all still say/use AxiomAnare (kept unchanged in the 20 Jul rebrand — see Part B above).
  Future sessions/self: if the folder or repo name "looks wrong" vs the LynxEyes branding, it is NOT drift —
  do not rename repo/folders/ref to match the product. Map: product = LynxEyes · repo + folders = AxiomAnare
  · Supabase ref = zjfhxutcvjxootoekade · worker = restless-tree-eac8. One project.
- **Color variable governance drift (found 6 Jul 2026):** despite CSS variables existing for exactly
  this purpose, index.html accumulated 43 hardcoded hex literals and 71 hardcoded rgba() literals over
  time, several of them near-duplicate colors of the real variables (three different "greens" were in
  simultaneous use: `--green`, a separate value in `.mgmt-card.green`, and a third in the print
  stylesheet). Values were reconciled during the 6 Jul theme conversion, but the literals still aren't
  wired to `var()` — a future edit to a variable won't propagate to them. Don't repeat the pattern:
  always reuse `var(--x)`, never hardcode a color that already has a named variable.
- **Nav logo is now a raster PNG (interim), not a vector (found/decided 7 Aug 2026):** the
  LynxEyes lynx-head lockup shipped as `lynxeyes-logo.png` because the only asset available was a
  flattened PNG-in-SVG wrapper, not true vector paths. Consequences knowingly accepted: it's
  teal/green on the blue app (off-palette vs the locked `#7bbde8`/`#1f6fb2` brand blues), the
  wordmark softens slightly when scaled, and it can't be recolored via CSS. Replace with a real
  blue vector SVG when one exists — do NOT treat the teal as the new brand palette. See Part B
  ("Why the product name is LynxEyes").
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
- **Internal-governance content reachable by the customer-facing prompt (found 3 Sep 2026):** the 9
  house-authored KB chunks embedded this session carry footers like "Governance: consistent with
  DECISIONS A1", and the four `cwru_benchmark_0x` chunks describe LynxEyes' own acceptance bar, labelled
  test files and guardrail IDs. `/rag` returned `cwru_benchmark_03` as a top-5 hit on OR_007, so this text
  is now injected into a customer's AI report prompt. It was written for humans reading the repo, not for
  the prompt. Fix (deferred, see below): exclude `category = 'benchmark'` from the RAG query and strip
  governance footers from reference chunks. Rule going forward: KB chunk text is prompt input — never put
  DECISIONS IDs, file names, or "acceptance bar" language in a chunk body.
- **Two ingest generations wrote different columns:** `rag_ingest.py` (121 rows) never set `category`;
  `embed_kb_whitepapers.js` (71 rows) did. `match_knowledge_chunks()` returns `category`, so 121 rows hand
  the prompt a NULL. `chunk_text`/`source_category` are legacy duplicates of `content`/`category` — nothing
  reads them. New ingest scripts must set `content`, `category`, `source_label`, `source_file`, `embedding`.
- **`rag_ingest.py` chunker emits overlap-only tail slivers:** a file under 600 tokens but over 500 gets a
  second ~60–80-token chunk that is pure overlap of the first. `rag_ingest_kb9.py` shortcuts single-window
  files; the original script (and some of the 121 rows) still has the quirk. Check before any re-ingest.

### Patterns explicitly REJECTED from the old third-party spec review (19 Jun 2026)
Reviewed and consciously NOT adopted — logged so they don't get reinvented worse later if anyone
references that document again:
- **Single-tenant-per-client deployment** ("a new deployment is required when new clients are added").
  Directly opposite to LynxEyes' org-scoped multi-tenant RLS model (A8). Do not import this.
- **Self-calibrating sensor hardware requirement** — not applicable; LynxEyes doesn't own sensor
  hardware, only processes uploaded files.
- **Three-tier RBAC (Admin / Advanced / Common user)** — LynxEyes' current model is binary
  (`is_admin` or not). Noted as a *possible* future pattern if Fleet customers want sub-roles within
  their own org, but NOT to be built speculatively — consistent with the project's tight scope control.

### Patterns explicitly REJECTED from the MechEyes/Gemini transcript review (3 Sep 2026)
Reviewed and consciously NOT adopted — see Part B (3 Sep 2026) for the review itself:
- **Unbalance as a FRACTION of total spectral energy** (`ratio_1x > 0.40`). Every healthy rotating machine
  has a dominant 1×, so this flags healthy motors and misses unbalance on machines with busy spectra.
  LynxEyes judges 1× by absolute velocity amplitude against ISO zone boundaries + peak ratios. Keep it that way.
- **Bearing fault = kurtosis > 4 AND crest factor > 5, with no frequency check.** That is an impact
  detector (looseness, cavitation, a dropped tool), not a bearing detector. LynxEyes' envelope BER + direct
  BER path is the correct method; never regress to statistics-only bearing calls. (Also note: the
  transcript mixed Fisher/excess kurtosis in code with Pearson thresholds in prose — an easy silent bug.
  LynxEyes' kurtosis convention must be stated once in CONFIG and used consistently.)
- **Confidence as arithmetic on a single metric** (`ratio_1x × 100`, `kurtosis × 15`, flat `75.0`).
  Uncalibrated numbers presented as percentages — exactly the over-diagnosis A2/A3/A13 exist to prevent.
- **Line-frequency energy check with a ±2 Hz window** as an electrical-fault rule. On a 2-pole motor the
  mechanical 1× sits inside that window (slip only), so it fires on every healthy machine. A4's cap on
  vib-derived electrical findings stands; proper electrical confirmation needs slip sidebands at Δf well
  below sideband spacing (A15) or a current channel (parked below).
- **Flat JSON rule schema** (primary_metric / operator / threshold + AND-list). Cannot express harmonic
  ratios, sideband presence, band energies or the axial-vs-radial decision trees the scorer already
  implements. LynxEyes' CONFIG-as-data + scorer logic is more expressive; don't replace it with a
  less capable DSL for the sake of "editable without code".
- **Early ML (gradient boosters / SMOTE trained on CWRU).** CWRU-trained classifiers are known not to
  transfer to field machines (small, clean, leakage across loads), and SMOTE fabricates physically
  implausible feature vectors. LynxEyes' sequencing — ML in Phase 4, behind real trend data, validated
  leave-one-machine-out — is the right order. Do not pull it forward on the strength of benchmark accuracy.
- **Vendor-agnostic via a Python/Streamlit rebuild.** The transcript's stack is irrelevant; LynxEyes'
  agnosticParser2.js already covers CSV/MAT/XLSX/JSON/TSV/TXT. Format coverage is extended in the
  existing parser, not by adopting a second pipeline.
- **Hardcoded acquisition defaults in the schema** (`sampling_rate = 10000.0`, `line_frequency = 50.0`,
  `poles = 4`, and `fs = 10000 # default fallback` in the parser). Same bug class as LynxEyes' old silent
  1.0 kHz default that A12 was written to kill — just a different number. The transcript's dataclass must
  never be used as a template; every acquisition value is detected, keyed, or flagged (A12).

### Deferred, not forgotten (open items with an explicit "not now")
- **Emoji cleanup in the UI** (17 instances found 6 Jul 2026) — violates the documented "no emojis in
  diagnostic output" standard. David explicitly asked to leave these until after current heavy-lift work
  is done, then do a housekeeping pass. This is a deliberate sequencing decision, not an oversight — do
  not "helpfully" fix it early, and do not let it silently drop off the list either.
- **MCSA current-channel cross-validation** (parked 3 Sep 2026). The transcript is right that motor
  current signature analysis is the proper way to CONFIRM electrical faults (broken rotor bars, eccentricity,
  stator faults) that vibration can only hint at. LynxEyes' electrical findings are vibration-derived and
  capped below Indicative (A4) — that is the honest position for a vibration-only tool. Adding a current
  channel is a scope expansion (parser, schema, new scorer branch, new KB material), not a bug fix.
  Revisit if Fleet customers supply synchronised current + vibration data. Not before Phase 3.
- **UFF / UNV (Universal File Format, Type 58) import** (parked 3 Sep 2026). Standard ASCII interchange
  format exported by Bently Nevada, SKF and similar platforms. Not in agnosticParser2.js. Whether it
  matters depends on whether target users export from enterprise systems or from portable collectors/
  loggers (which mostly emit CSV). Decide from real user file samples during Phase 1.5/3 — do not build
  speculatively.
- **BPFI misfiring on Ball_007** (found 2 Sep 2026): the dual-path BPFI direct
  BER picks up significant energy at 162.2 Hz on the Ball_007 file, causing
  Inner Race to rank above Rolling Element on a known ball fault file. The two-tier
  language correctly hedges this ("INDICATIVE ONLY") so it does not produce a
  wrong confident diagnosis. Possible fix: require minimum 2 harmonics above
  threshold before BPFI direct path fires, or reduce BPFI direct weight vs
  envelope weight. Deferred — not a language/honesty problem, and low priority
  given two-tier hedging covers it.
- **Load state as an input field** (parked 3 Sep 2026, MechEyes review). Idle vs full-load shifts vibration
  levels; LynxEyes has no load field. A cheap "load %, if known" metadata input surfaced under the A12
  assumptions note is worth adding when A12 is built (Phase 2). Not before.
- **RAG hygiene follow-ups from the 3 Sep embed pass** (do together, one small session): (1) exclude
  `category = 'benchmark'` from `/rag` or the RPC; (2) strip governance footers from the 5 `bearing_0x`
  chunks and re-embed; (3) backfill `update knowledge_chunks set category = source_category where category
  is null` (121 rows, prod data change — A9 snapshot first); (4) `KB/Reference/CWRU_Dataset_Overview.md`
  was never ingested — decide whether it still adds anything next to `cwru_benchmark_01`; (5) drop
  `knowledge_chunks_bak_20260903` once (1)–(3) are verified.
