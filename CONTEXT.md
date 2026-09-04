# LynxEyes — Living Project Context
Last updated: 3 Sep 2026
Latest code commit: ac779ab (BER-DEBUG logging removed, scorer ba160b1-6 — no scoring change).
  Docs/scripts commit for this session follows ac779ab (see Session Log 3 Sep).
  KB: 201 chunks, ALL embedded (192 + the 9 house-authored chunks from 5aa2904).
  DB snapshot knowledge_chunks_bak_20260903 exists — drop after RAG hygiene pass.
Company: Kairos Ventures Pte Ltd

---

## What this product is
LynxEyes is an AI-augmented, ISO-ringfenced vibration diagnostic engine for
condition monitoring of rotary motors and pumps. Users upload vibration data
files (CSV, MAT, XLSX, JSON, TSV, TXT), the app runs them through a 6-stage
diagnostic pipeline, classifies machine condition per ISO 10816-3, scores
fault probabilities, and generates AI diagnostic recommendations via the
Claude API. A Fleet Dashboard lets organisations manage multiple assets with
RLS-protected data in Supabase. Goal: a commercially launchable freemium SaaS
— free tier, paid subscriber tiers, fleet management, admin tooling.

---

## Repository & Hosting — CONFIRMED 2 Jul 2026, unchanged since
- **Repo:** https://github.com/KairosAxiom/AxiomAnare
- **Live:** https://kairosaxiom.github.io/AxiomAnare — confirmed working,
  this is the site David stress-tests against.
- `esimconnect` is NOT the owner — it only resolves via a GitHub redirect to
  `KairosAxiom`. Do not use `esimconnect` in links, docs, or a new project's
  instructions. A stale saved "Project Instructions" draft containing
  `esimconnect` + other outdated figures (see below) keeps resurfacing across
  sessions — delete that saved copy.
- README.md in the repo still has a stale/wrong live link
  (`limykdavid-maker.github.io/axiomanare`, 404) — leftover from before the
  move to `KairosAxiom`. **Open task**, see Not Started.
- Local: D:\Kairos\AxiomAnare\axiomanare\AxiomAnare (drive letter varies —
  D: office / GENESIS-PRJ3, E: home / DadThinkPadE495)
- Git: `cd /d/Kairos/AxiomAnare/axiomanare/AxiomAnare` then standard
  git add/commit/push
- Branch: main
- Stable tag: v1.0-stable — commit 4ef5762

> **⚠️ Folder-vs-brand naming — READ IF THE PATHS LOOK WRONG.** The *product*
> rebranded to **LynxEyes** (name set 20 Jul 2026; singular→plural spelling corrected 7 Aug 2026),
> but the **GitHub repo, the local disk
> folders, and the Supabase project ref were all deliberately kept unchanged** —
> so the names DON'T all say "LynxEyes", and that is intentional, not drift:
>   - **Product / brand name:** LynxEyes (what users, UI, reports, logo show)
>   - **GitHub repo:** still `AxiomAnare` → live URL `kairosaxiom.github.io/AxiomAnare`
>     (repo was NOT renamed; GitHub redirect + "only display name changed" decision)
>   - **Local folders:** still `AxiomAnare` — they match the *repo*, not the product.
>     Path `…\Kairos\AxiomAnare\axiomanare\AxiomAnare` — the triple-nesting is a
>     harmless clone artifact, not three different things.
>   - **Supabase project ref:** still `zjfhxutcvjxootoekade` (immutable; only the
>     dashboard *display label* was renamed to LynxEyes).
>   - **Cloudflare worker:** still `restless-tree-eac8` (invisible; not renamed).
>
> **One-line map:** product = LynxEyes · repo + folders = AxiomAnare · Supabase ref =
> zjfhxutcvjxootoekade · worker = restless-tree-eac8. **All the same one project.**
> See DECISIONS.md Part B ("Why the repo/folders/ref kept the AxiomAnare name").

### Stale-draft figures to never reintroduce
A saved Project Instructions draft has been pasted into chat multiple times
carrying facts that are wrong or superseded. Do not copy these into a new
project or a fresh instructions field:
- Org/repo `esimconnect` (correct: `KairosAxiom`, see above)
- Free tier "2 analyses" (correct: `FREE_ANALYSIS_LIMIT = 5` in app.js)
- profiles / asset_twins / case_library / knowledge_chunks / usage_log /
  subscription_events marked "(planned)" (correct: all 12 tables are LIVE in
  production, RLS v2 applied — see Supabase section below)
- 10-item CSS variable list (correct: 16 — see Tech Stack below)
- No mention of RLS, the Cloudflare Worker, or the RAG pipeline at all —
  all three are core to how this project actually works

---

## Tech Stack
| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vanilla JS, HTML, CSS | no framework, no build step |
| Fonts | Barlow Condensed (headings/labels), IBM Plex Mono (all data/code display), IBM Plex Sans (body) | |
| Charts | Chart.js 4.4.1 | FFT + radar + trend |
| Parsers | PapaParse (CSV), SheetJS (XLSX), custom MAT parser | agnosticParser2.js |
| Backend | Supabase — Postgres + Auth + Storage + pgvector | ref `zjfhxutcvjxootoekade` |
| AI | Anthropic Claude API, `claude-sonnet-4-20250514`, max_output_tokens 1000 | via Cloudflare Worker proxy — confirm this model string is still current next time it's touched |
| Payments | Stripe (primary), PayPal (secondary, deferred) | |
| Hosting | GitHub Pages, org `KairosAxiom` | see Repository section above |
| Currency | USD primary, local via Stripe/PayPal auto | |

### CSS variables (defined in index.html `:root`, reused across pages)
16 total — a previously documented list of 10 was incomplete:
`--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`,
`--accent`, `--accent2`, `--green`, `--yellow`, `--orange`, `--red`,
`--purple`, `--text`, `--muted`, `--dim`

**Current palette: cream/light theme** (converted from dark navy 6 Jul 2026).
Example values: `--bg:#faf8f3`, `--surface:#ffffff`, `--text:#1c1f26`,
`--accent:#1f6fb2`. Full values live in index.html.

**Known governance gap (open, not yet remediated):** many colors in
index.html are hardcoded hex/rgba literals that do NOT reference the
`:root` variables. A proper pass to replace these literals with actual
`var()` references is real cleanup debt, not done yet. Do not introduce
new hardcoded color literals going forward — always reuse the variables.

---

## Coding standards & assistant operating rules
- Read this file (CONTEXT.md) first, every session, before writing any code.
- Match existing code style in all files.
- Inline styles preferred over new CSS classes (existing pattern in this repo).
- IBM Plex Mono for all data/code display; Barlow Condensed for headings/labels.
- Always maintain ISO standard references in the UI.
- Never remove existing functionality — extend only.
- All Supabase queries must respect RLS policies (see RLS section below).
- Shared logic goes in separate .js files, not duplicated per page.
- Maintain consistency across index.html, fleet.html, admin.html, and any new pages.
- Keep the engineering credibility of the product — no casual language in
  the UI. **No emojis in diagnostic output is the stated standard, but it
  is currently NOT enforced** — 17 emoji character entities are live in
  index.html. David has explicitly deferred cleanup until after current
  heavy-lift work. Do not silently fix it or forget it — see Not Started.
- Respect the caveat, everywhere: AI output requires qualified engineer
  review and sign-off. It is a draft, not a certified determination.
- Update this file with decisions made in each chat; re-upload to Project
  Knowledge and commit to repo as a discrete closing step.
- Validate migrations in a sandbox Postgres instance before running on production.
- Verification-driven: want actual evidence (logs, query results, screenshots)
  before marking anything complete.
- Tight scope control: park out-of-scope ideas explicitly (see DECISIONS.md
  PART C) rather than building speculatively.

---

## Diagnostic Engine — Two-Tier Output Model (DECISIONS A13, formalised 2 Sep 2026)

**Tier 1 — Severity (always confident):**
ISO zone from RMS velocity vs ISO 10816-3 boundaries. Zone D/C drives urgency
and required action unconditionally. Never hedged — it is an objective
measurement against a published standard boundary.

**Tier 2 — Fault type (honest confidence):**
- Shaft-synchronous faults (unbalance, misalignment, looseness): detected from
  raw FFT peak ratios. Stated as "likely driver" when confidence ≥ 20%.
  Reliable from a single file.
- Bearing faults (BPFO, BPFI, BSF, FTF): detected via dual-path envelope BER
  + direct FFT BER. Stated as "indicative only" always on a single reading.
  Single-file analysis cannot confirm bearing fault type without resonance
  frequency knowledge. Confident identification requires trend over multiple
  readings (CF + kurtosis rising over time).

**Single-reading caveat:** Zone C/D from a single file without trend history
appends "Re-measure to confirm before shutdown decision" — severity is real,
one reading cannot rule out transients.

**CWRU benchmark acceptance bar (Smith & Randall–based, formalised 2 Sep 2026):**
- Normal: Zone A/B, no confident fault. ✓
- IR_007 / OR_007 / OR_021: correct bearing category elevated, indicative language. ✓
- Ball_007: indicative/hedge is acceptable and correct per S&R (ball faults are
  the hardest category; BPFI misfiring on Ball_007 is a known limitation — see
  DECISIONS Part C).
The old "5/5 confident identification" bar is explicitly retired — it pushed
toward over-diagnosis, violating A2/A3.

---

## Supabase
- Project: "Kairos Axiom" (FREE tier) / LynxEyes / main (PRODUCTION)
- URL: https://zjfhxutcvjxootoekade.supabase.co
- Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmh4dXRjdmp4b290b2VrYWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjgzODAsImV4cCI6MjA5MDcwNDM4MH0.5yGgSjALJhTQm5Ud3W-fU2Bgo-3PkziaS0oLrGMYQ9o
  (note: fleet.html / index.html also reference a publishable key
  sb_publishable_lM8rmd2rwRo3-XXW_iOy2A_28Zinsh8)
- pgvector: enabled
- Keep-alive: Cloudflare Worker cron "0 9 */3 * *" — VERIFIED firing

### LIVE TABLES (12 — confirmed via Table Editor 22 May)
asset_twins, assets, baselines, bearing_library, case_library,
fault_signatures, knowledge_chunks, nvr_records, organisations,
profiles, subscription_events, usage_log

### SCHEMA DRIFT — IMPORTANT
The committed schema file (axiomanare_schema.sql) and the live DB have diverged.
See prior session logs for full detail. Net live state = 12 tables.
fault_detections and zone_progressions are in the schema FILE but were NEVER
created in prod.

### profiles columns (confirmed 22 May)
id (uuid PK), org_id (uuid), tier (tier_name enum),
subscription_status (subscription_status enum), stripe_customer_id (text),
stripe_sub_id (text), paypal_sub_id (text), asset_addon_count (int),
analyses_used (int), billing_interval (text), created_at, updated_at,
is_admin (boolean — ADDED 22 May by RLS migration)

---

## RLS — ROW LEVEL SECURITY (hardened 22 May, verified on prod)
See prior session logs for full detail. Status: CLOSED and org-scoped.
rls_foundation_v2.sql applied to prod. All customer data is org-scoped.
bearing_library keeps anon SELECT (free diagnostic needs it).
First admin bootstrapped: davidlimyk@gmail.com — attached 4 Sep 2026 to the
existing org "Kairos Axiom" (b0a5b185…) as owner.

### org-of-one — IMPLEMENTED 4 Sep 2026 (org_of_one_v1.sql, run on prod)
- profiles BEFORE INSERT `trg_ensure_profile_org`: creates an organisation-of-one
  when org_id is NULL (fires after handle_new_user).
- assets BEFORE INSERT `trg_assets_fill_org_id`: org_id := current_org_id() if omitted.
- nvr_records BEFORE INSERT `trg_nvr_records_fill_org_id`: org_id from parent asset.
- Column guard relaxed ONLY for moving between orgs the user owns (owner_id = auth.uid()).
- nvr_records.created_at added 4 Sep (nvr_records_created_at_v1.sql, indexed) —
  same-day tie-break only; recorded_at stays the sequence truth.
- No RLS policy was changed. rls_foundation_v2 policies remain authoritative.
- Client side: app.js `SB` now sends the session JWT (SB_VERSION sb-jwt-1) and
  logs every non-2xx (DECISIONS A16). Anonymous users skip asset/history lookup.

### Supabase Auth → URL Configuration (fixed 4 Sep 2026)
Site URL `https://kairosaxiom.github.io/AxiomAnare`; Redirect allow-list
`https://kairosaxiom.github.io/AxiomAnare/**`. esimconnect entries removed.

---

## Tier Structure
| Tier          | Price   | Analyses  | Assets | AI Report | Fleet |
|---------------|---------|-----------|--------|-----------|-------|
| Free          | $0      | 5         | —      | ✗         | ✗     |
| Pro           | $49/mo  | Unlimited | —      | ✓         | ✗     |
| Fleet Starter | $99/mo  | Unlimited | 10     | ✓         | ✓     |
| Fleet Pro     | $299/mo | Unlimited | 30     | ✓         | ✓     |
| Asset add-on  | $25/mo  | —         | +1     | ✓         | ✓     |

FLEET_GATING_ENABLED = false in fleet.html — flip to true before launch.

---

## Cloudflare Worker — restless-tree-eac8
Dashboard-managed — no wrangler.toml, no CLI deploy.
Secrets bound: ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL,
VOYAGE_API_KEY (Stripe secrets still TODO).
CRON "0 9 */3 * *" — keep-alive ping VERIFIED firing.

### RAG Pipeline (live)
PDF/MD → chunk → embed (voyage-3, 1024-dim) → knowledge_chunks (pgvector)
→ at analysis: semantic query → /embed → /rag → top-5 chunks (0.30 similarity
floor) → injected into Claude system prompt.

---

## Completed Work (high-level)
Single/multi-channel diagnostic pipeline, PDF export, Fleet Dashboard,
agnostic file parser, RAG pipeline, Stripe integration (code, not live),
RLS foundation (applied to prod), admin bootstrap, CWRU benchmark,
tier gating (fleet behind flag), Supabase keep-alive cron (verified),
KB at 201 chunks embedded (3 Sep 2026). Two-tier output model (A13) implemented and
verified against CWRU Normal + Ball_007 files (2 Sep 2026). Asset persistence +
trend restored and verified with a non-admin free account (4 Sep 2026, Session 11).

## In Progress
- [ ] Admin dashboard (admin.html) — status not re-verified recently
- [ ] Phase 1.5 stress testing (see Build Sequence). Free-flow under RLS: CLOSED
      4 Sep (Session 11). Next: trend-DIRECTION test, fleet flow, Stripe wiring.

## Testing-phase flags (flip before launch)
- `FLEET_GATING_ENABLED = false` (fleet.html)
- `FREE_SIGNUP_ENABLED = true` (auth.js, added 4 Sep) — Subscribe modal offers a
  $0 Free card that creates the account with NO Stripe call. Decide before
  launch: (a) keep Free-with-persistence as the funnel hook, or (b) false.
- Test artefacts on prod: org 70eb23a1… (kairosventure.io@gmail.com, tier=free,
  NON-admin — use this for persistence/trend tests, not the admin account) with
  assets CWRU Test 06 (5 same-day readings), CWRU_OR (2), CWRU-97/105/118/234
  single-reading assets. Harmless; delete when convenient.

## Not Started
- [ ] AI narrative: baseline reading (or any reading with no stored baseline)
      reports a self-comparison deviation_sigma (30+σ seen) and the AI report
      narrates it as a "step-change from baseline" — on the baseline itself.
      Fix: null/omit deviation_sigma when is_baseline or no stored baseline
      exists; tell the prompt explicitly "no baseline established."
- [ ] AI narrative: Zone A (healthy) readings get "likely driver" fault
      language (e.g. "Mechanical Unbalance — Elevated, likely driver" on a
      0.55 mm/s Zone A machine). Scorer works on FFT peak ratios, so a clean
      healthy 1× tone scores like an unbalance signature. Over-diagnosis in
      exactly the place A13 exists to prevent. Candidate fix: gate "likely
      driver" language by ISO zone. Needs a DECISIONS entry once agreed
      (candidate A17) — found 4 Sep 2026, synthetic trend set 01.
- [ ] Health index appears weighted toward the indicative tier (fault score /
      kurtosis) more than the confident tier (zone) — 12-point health drop
      between two zones on synthetic set 01. Review formula against A13.
- [ ] FFT + Radar chart legibility: radar axis labels overlap the plot and
      each other; FFT card cramped sharing a row with radar at current width.
      Confirmed visually 4 Sep 2026. Layout/CSS only — verify no data-binding
      touched before skipping the CWRU re-run.
- [ ] Trend states PRS (slope 0.04–0.15) and SCO (step-change, sd 3.5) not yet
      exercised by any test. Synthetic set 01 only reached PRA. Needs a
      slow-creep set (PRS) and a sudden-jump-on-flat-baseline set (SCO).
- [ ] "Loose Foundation" (15.0 Hz, 8 harmonics, score 10) appearing on
      synthetic files with no sub-harmonic content from reading 3 onward —
      likely noise-floor/threshold issue, not yet confirmed.
- [ ] Synthetic data generator ran ~2× low on RMS velocity (calibration bug
      in the test-data script, not the app) — zones landed one band low
      (A,A,A,B,B,C vs intended A,A,B,C,C,D). Trend direction/order unaffected.
      Fix generator calibration before set 02.
- [ ] Fix README.md's stale live-app link
- [ ] fleet.html register path NOT re-verified after org_of_one_v1 guard change
      (creates org then assigns it — guard now permits only owner→owner moves)
- [ ] fleet.html fetch helpers not audited for A16 (non-2xx logging)
- [ ] app.js `SB` comments cite "DECISIONS A14" — should read A16; fix on next touch
- [ ] Sample-rate provenance: CWRU_OR_fault_007 gave sr 12048 / shaft 29.414 Hz on
      two runs and 12000 / 29.950 on another, same scorer. Input-source difference
      (auto-detect vs entered), not scoring. Check the Analysis Assumptions note (A12).
- [ ] Delete stale untracked rls_foundation.sql (v1) from working dir
- [ ] Emoji cleanup in UI (17 instances) — explicitly deferred by David
- [ ] Color-literal-to-var() cleanup
- [ ] Digital twin Phase 1, ML feature extraction, case library population,
      email notifications, annual pricing logic, PayPal integration,
      Supabase Storage buckets, NASA IMS 3rd_test, KB Q1/Q3/Q4 reports,
      CAT 1 manual, CWRU 48kHz files, 6205-2RS bearing addition
- [ ] Data quality tiering (DECISIONS A10) and component-replacement trend
      reset (DECISIONS A11) — Phase 2, not urgent yet
- [ ] Mandatory input metadata / no silent defaults (DECISIONS A12) —
      formalized, not yet implemented. Known live gap: sample rate silently
      defaults to 1.0 kHz when omitted.
- [ ] Phase 1.5 stress testing: fleet flow, Stripe wiring, close small bugs
      (count-of-1 badge pluralisation). Free-flow under RLS closed 4 Sep.
- [ ] Flip FLEET_GATING_ENABLED to true before launch
- [ ] Wire lynxeyes.io when acquired (Supabase Auth redirect, Worker CORS,
      Stripe URLs)
- [ ] Replace interim teal raster logo with true blue vector SVG
- [ ] Delete unreferenced lynxeye-logo-static.svg
- [ ] Rename Supabase project display label to LynxEyes (if not already done)
- [ ] Fix README stale link

---

## Build Sequence
```
PHASE 1 — Foundation                                   ✓ DONE (core)
PHASE 1.5 — Stress testing (coverage + accuracy)       ← current priority
├── Anonymous free-flow under RLS
├── Fleet flow under RLS
├── Diagnostic accuracy vs CWRU labelled benchmark     ← two-tier model live
├── File-format coverage + edge cases
└── Robustness (malformed files, odd sample rates, missing metadata)

PHASE 2 — Intelligence (pre-launch)
├── Digital twin Phase 1 (Fleet)
├── Data quality tiering (A10) / component-replacement reset (A11)
├── Mandatory input metadata (A12)
└── Supabase Storage buckets, CWRU/NASA feature extraction

PHASE 3 — Growth (post-launch)
PHASE 4 — ML (12-24 months)
```

---

## Files In This Project
| File | Purpose |
|---|---|
| CONTEXT.md | This file — update after every chat |
| DECISIONS.md | Guardrails + rationale — read Part A every session |
| STATUS.md | Session handover, anchors, next tasks |
| ARCHITECTURE.md | How it's built |
| DEPLOY_CHECKLIST.md | Run after every push |
| index.html | Main diagnostic app — cream/light theme |
| app.js | Diagnostic engine, Freemium object |
| auth.js | Shared auth module |
| fleet.html | Fleet dashboard (own auth; gating behind flag) |
| admin.html | Admin dashboard — status unverified |
| agnosticParser2.js, multiChannel.js | Parser + multi-channel logic |
| axiomanare-proxy.js | CF Worker source |
| rls_foundation_v2.sql | RLS migration (utility, keep for record) |
| rag_ingest.py, rag_embed.py | Original Python KB ingest/embed pair (needs .env with Voyage key; KB_ROOT hardcoded to E:) |
| embed_kb_whitepapers.js | One-shot whitepaper embedder via Worker /embed (no dedup — do not re-run) |
| rag_ingest_kb9.py | 3 Sep: targeted ingest for the 9 house-authored chunks; sets `category`; drive-agnostic |
| rag_embed_via_worker.py | 3 Sep: embeds NULL-embedding rows via Worker /embed — no local Voyage key needed |
| .env (untracked, gitignored) | SUPABASE_URL + SUPABASE_SERVICE_KEY (sb_secret_) for the Python scripts |

---

## Session Log — 2 Sep 2026 (Diagnostic engine — two-tier output model + CWRU scorer arc)

```
This session covered two arcs: (1) a sustained CWRU bearing-scorer fix
attempt, and (2) a strategic direction reset that produced the two-tier
output model (DECISIONS A13). Both are now committed and verified.

CWRU SCORER ARC (commits 8570d6a → ba160b1 → d2cc7bd → bac213c):

  Step 1 — Signal source confirmed: CF, kurtosis, fft._rawSignal and the
  entire envelope pipeline all operate on the ACCELERATION signal (detrended,
  in g). Integration is only applied in the separate spectral velocity RMS
  path for ISO zone. This was confirmed by code reading, not assumption.
  Fix is ONE change, not two.

  Step 2 — Race band root cause fixed (8570d6a):
  CONFIG.envelope_bands.race = {lo:3000, hi:4500} was mis-placed for 12 kHz
  data. Replaced with Nyquist-adaptive band computed from fft.fs at runtime:
  lo = max(1000, 0.20×Nyq), hi = 0.65×Nyq. At 12 kHz: 1200–3900 Hz,
  centred on CWRU 6205 resonance. A4 ranking hierarchy also added to sort:
  bearing/mechanical always outranks vib-derived electrical at non-trace
  confidence.

  Step 3 — Dual-path BER for BPFO/BPFI (ba160b1):
  Wide adaptive band (originally 0.10–0.85×Nyq) was effectively a highpass,
  not a bandpass — envelope BER stayed near 1.0. Added direct raw FFT BER
  fallback path (max(envBER, directBER)) for BPFO and BPFI, same pattern
  as bsfDirect already in BSF branch. maxRaceBer pre-compute extended to
  include direct BER so OR files correctly trigger mechCap suppression.

  CWRU re-run results after ba160b1 fixes:
  Normal → Zone B, no confident fault ✓
  Ball_007 → Zone D, bearing signal elevated (BPFI misfiring — known) ✓ hedge
  IR_007 → Zone D, Inner Race Elevated (BPFI direct=21.727 fired) ✓
  OR_007 → Zone D, bearing present, mechCap=10 ✓ (fault type still hedged)
  OR_021 → Zone D, bearing present ✓ (fault type hedged)

STRATEGIC DIRECTION RESET:
  Session paused mid-scorer-arc to review product direction. Key finding:
  the engine was reliable on severity (ISO zone from RMS) but unreliable
  on confident bearing fault TYPE from a single file — which is correct
  behaviour, not a bug, given no resonance frequency knowledge is available.
  Real hardware analysers solve this with sensor-housing resonance knowledge;
  software-only tools from raw uploads cannot replicate this without trend data.

  Decision: adopt two-tier output model (DECISIONS A13):
  - Tier 1 (severity): always confident, from ISO zone. Drives urgency.
  - Tier 2 (fault type): shaft-synchronous faults → "likely driver" (reliable
    from raw FFT); bearing faults → "indicative only" always on single reading.
  - Single-reading caveat on Zone C/D when no trend history.
  - CWRU acceptance bar redefined: severity correct + bearing category elevated
    + indicative language = PASS. "5/5 confident ID" bar retired.

TWO-TIER IMPLEMENTATION (d2cc7bd, bac213c):
  - plainFaultText() split into two tiers — bearing uses "signal activity at
    [frequency]. Indicative — inspect bearing."; shaft-sync uses "likely driver".
  - Management summary card RAG logic updated: Zone drives urgency first,
    fault type follows with appropriate confidence. Bearing-only indicative
    signal in Zone A/B now shows softer language ("weak bearing signal noted,
    re-measure at next interval") not inspection urgency.
  - buildFallback fA text updated: all four bearing types use "INDICATIVE ONLY —
    single-file envelope analysis cannot confirm bearing fault type."
  - Short-term action for bearing: "Inspect only if trend confirms deterioration."
  - AI prompt updated with explicit TWO-TIER OUTPUT MODEL section and revised
    anti-hallucination rules. Report sections restructured: severity leads.
  - isBearingFault() helper added.

VERIFIED LIVE (bac213c, scorer version ba160b1-5):
  Normal: Zone B, amber, "Weak bearing signal noted... re-measure at next
    interval." No inspection language. AI report: bearing findings explicitly
    stated as indicative, no confirmation. ✓
  Ball_007: Zone D, "Action Required", bearing language "INDICATIVE ONLY",
    short-term "Inspect only if trend confirms deterioration." ✓
    Known: BPFI misfiring as top fault on a ball fault file — logged in
    DECISIONS Part C as known limitation, not a two-tier language problem.

BER-DEBUG logging: still active in app.js (console.log at ~line 2101).
  Remove this before the KB embed pass.

STILL OPEN / next session:
  1. Remove BER-DEBUG console.log from app.js.
  2. Embed the 9 KB chunks (5aa2904 repo-only) — requires BER-DEBUG removed
     first so both are validated in one clean pass.
  3. Resume Phase 1.5: free-flow under RLS (incognito), fleet flow, Stripe.
  4. Housekeeping: README stale link, emoji cleanup (17), color-literal→var(),
     Supabase display label rename, lynxeyes.io domain wiring when acquired.
  5. BPFI-on-Ball known limitation: consider adding minimum harmonic count
     requirement or reducing BPFI direct weight to reduce false positives.
     Low priority — two-tier language already hedges this correctly.
```

## Session Log — 3 Sep 2026 (Session 10 — BER-DEBUG removal, KB embed, free-flow RLS reproduced)
```
Pre-work: DECISIONS.md reconciled. The 3 Sep MechEyes-review copy carried a
RECONSTRUCTED A13 (flagged in-file); the original 2 Sep wording (DECISIONS_A13_patch.md)
was spliced in, plus its Part B "Why the two-tier output model was adopted" entry and the
original Part C BPFI-on-Ball note. Reconstructed-A13 warning removed. A14/A15 and the
MechEyes review entries untouched. Also added two MechEyes extras David approved:
Part C rejected "hardcoded acquisition defaults in the schema"; Part C deferred
"load state as an input field" (Phase 2, with A12).
Note: 68d2190 (between bac213c and today) = 2 Sep docs close — nothing undocumented.

1. BER-DEBUG removed — commit ac779ab.
   app.js: 7-line [BER-DEBUG] console.log block (~L2104) deleted; SCORER_VERSION bumped
   ba160b1-5 → ba160b1-6 purely as a deploy marker. No scoring change (the log only
   formatted values still computed for scoring). node --check clean. Verified live:
   console shows "scorer version: ba160b1-6", no [BER-DEBUG] line on analysis.

2. KB embed — 192 → 201, all embedded, retrieval verified live.
   - A9 snapshot first: create table knowledge_chunks_bak_20260903 as select * … (192 rows).
   - Dedup check: none of the 9 filenames present; ALSO found KB/Reference/
     CWRU_Dataset_Overview.md was NEVER ingested (not in rag_ingest.py SOURCES).
   - Schema reality: match_knowledge_chunks() returns content, category, source_label,
     source_file (+embedding). chunk_text/source_category are legacy duplicates.
     121 of the original 192 rows have category = NULL (rag_ingest.py never set it;
     embed_kb_whitepapers.js did for its 71).
   - New script rag_ingest_kb9.py (same deterministic-UUID upsert convention as
     rag_ingest.py; sets category; KB_ROOT relative to script). Dry run initially
     showed 11 rows: bearing_05 (582 tok) and cwru_03 (556 tok) each produced a
     second overlap-only tail sliver — chunker quirk inherited from rag_ingest.py.
     Fixed with a single-window shortcut → 9 rows exactly.
   - Office machine (GENESIS-PRJ3) had no .env and no tiktoken/voyageai — installed
     (tiktoken 0.14 builds on Py 3.14). Added .env to .gitignore (was NOT ignored
     before). Supabase now issues sb_secret_ keys — used as SUPABASE_SERVICE_KEY;
     publishable key is anon-equivalent and would be blocked by admin-only RLS.
   - No local Voyage key available (CF secrets are write-only; no known Voyage login).
     Wrote rag_embed_via_worker.py: embeds via Worker POST /embed ({text}→{embedding}),
     tries Origin kairosaxiom.github.io then esimconnect.github.io. 9/9 embedded,
     dim 1024. SQL: 201 total / 201 embedded.
   - Live retrieval check on OR_007: /rag top-5 = bearing_02 (0.511, #1),
     Spectrum Analysis.pdf (0.502), Vibration_Reference.md (0.446, category NULL),
     cwru_benchmark_03 (0.422), PRUFTECHNIK handbook (0.420). Embed proven.
   - FINDING: cwru_benchmark_03 is INTERNAL content (acceptance bar, DECISIONS IDs,
     labelled test files) and bearing_0x chunks carry "Governance: … DECISIONS A1"
     footers — now injected into the customer-facing AI prompt. AI report text not yet
     audited for leakage. Logged in DECISIONS Part C (pitfall + deferred RAG hygiene
     bundle: exclude category='benchmark' from /rag, strip footers + re-embed, backfill
     category, decide on CWRU_Dataset_Overview.md, then drop the _bak table).

3. FREE-FLOW UNDER RLS — REPRODUCED (Phase 1.5 #1, evidence captured).
   Logged out ("Free to Try"), OR_007 analysis: report renders, AI streams, but
   app.js:118 POSTs to /rest/v1/nvr_records (x2) and /rest/v1/assets return
   401 Unauthorized (anon role denied by org-scoped RLS — exactly A8). No user-visible
   error: the save fails SILENTLY. Design decision still open: force sign-in for the
   free tier vs a deliberately scoped anon exception. Do NOT reopen policies (A8).
   This is next session's first item.

Files changed this session:
  app.js (ac779ab) · DECISIONS.md (reconciled + Part C) · CONTEXT.md (this) ·
  STATUS.md · .gitignore (+.env) · NEW rag_ingest_kb9.py, rag_embed_via_worker.py.
  Delete from working dir: DECISIONS_A13_patch.md (merged), patch_kb9.js (already rm'd).
  Untracked and staying untracked: CONTEXT_admin_session_entry.md, Development Papers/,
  Logo/, NEXT_SESSION_BRIEF.md, SHAFT_FIX_2026-07-21.md, rls_foundation.sql, .env.

Next session (in order):
  1. Free-flow under RLS: decide sign-in vs scoped anon exception; implement; verify
     incognito with 0 red errors and a row in nvr_records. Update DEPLOY_CHECKLIST §5.
  2. Audit one AI report for internal-governance leakage; then RAG hygiene bundle
     (DECISIONS Part C, deferred) — small, do it in one pass.
  3. Fleet flow under RLS, Stripe wiring (Phase 1.5 continues).
  4. Housekeeping: README link, Supabase display label, emoji (17), color-literal→var(),
     ISO 20816-3 edition question (A1 open item — rank above cosmetics).
  5. A14 measured-1x anchoring (also answers the "shaft auto-detect slightly off" question)
     and A15 resolution guard — Phase 1.5 accuracy work, CWRU re-run after (A6).
```

## Session Log — 4 Sep 2026 (Session 11 — trend regression root-caused and fixed)
```
Opened as a product-objective review: are trend, amplitude and frequency all
factored in? Amplitude (RMS → ISO zone) and frequency (comb search, BPFO/BPFI/
BSF/FTF, envelope/BER) confirmed solid. Trend found DEAD; David confirmed it had
worked before the rename. Session 10's "free-flow RLS reproduced" item was the
same bug seen from the anonymous side.

ROOT CAUSE (Network tab, incognito + signed-in reasoning) — three layers:
  1. RLS v2 (22 May) refuses anon writes → 42501 on POST assets / nvr_records.
     Correct behaviour (A8).
  2. app.js `SB` sent the ANON key as Bearer on every call, never the session
     JWT — signed-in users were refused too.
  3. `SB` swallowed every non-2xx as `null` with no log → resolveAsset →
     {id:null} → history [] → "DDU, 0 readings — need 3+". Indistinguishable
     from a fresh asset. Console showed nothing.
  4. Even with a JWT: index.html signups have profiles.org_id = NULL
     (handle_new_user never created an org) and the client never sent org_id
     → org-scoped WITH CHECK fails. "Org of one" was never implemented.
  Consequence: NO nvr_records / fault_signatures rows written by anyone since
  22 May. All asset history starts from zero after the fix.

COMMIT 3f59f45 — app.js (SB_VERSION sb-jwt-1), auth.js, org_of_one_v1.sql:
  - SB resolves session JWT lazily at request time (app.js loads before
    supabase-js/auth.js); logs "[SB] METHOD table -> HTTP nnn — code message"
    on every non-2xx (A16); skips asset/history lookup when not signed in;
    `persistState` ('anon'|'ok'|'failed') carried on nvr as `_persist`;
    Stage 2/3 text and trend-card badge say "Sign in to save readings and trend
    this asset" (anon) or "NOT saved (see Console)" (failed). Baseline toast
    "Login to save" opens the auth modal instead of linking to fleet.html.
    SCORER_VERSION unchanged (ba160b1-6) — no diagnostic change.
  - auth.js: FREE_SIGNUP_ENABLED flag (true). Free card → signUp → success
    panel with Sign-in button, no Stripe. Button label switches "Create Free
    Account" / "Continue to Payment". Restored _showSignupSuccess() (dropped
    by the Stripe session).
  - org_of_one_v1.sql: create_org_of_one(); profiles BEFORE INSERT auto-org;
    assets BEFORE INSERT org_id := current_org_id(); nvr_records BEFORE INSERT
    org_id from parent asset; guard relaxed for owner→owner org moves only;
    backfill (found no NULL rows after the pre-step below). Zero policy changes.
  - Pre-step run by hand: organisations "Kairos Axiom" owner_id := David;
    David's profile org_id := Kairos Axiom (guard disabled for that statement).
  - Supabase Auth URL Configuration was still esimconnect.github.io — email
    confirmation 404'd. Set Site URL + /AxiomAnare/** allow-list to kairosaxiom.

VERIFIED on prod with NON-admin free account kairosventure.io@gmail.com:
  5/5 uploads → nvr_records 201, org_id auto-filled by trigger, Stage 2
  baseline comparison live (51.99σ vs stored baseline on reading 2).

TWO MORE TREND BUGS found during verification → COMMIT 97ebc25
(SCORER_VERSION ba160b1-7; nvr_records_created_at_v1.sql run on prod):
  1. Off-by-one: computeTrendFromHistory counted only STORED readings; the
     current reading is not stored until after analysis, so upload 3 still
     said DDU while the trend card said "3 readings". Fixed: trendSeries =
     [current, ...history]; singleFile / historyCount / AI-prompt flags all use
     the same count.
  2. Timestamp collision: recorded_at = measurement date at fixed 12:00 UTC;
     same-day readings tie; Postgres returned them in arbitrary order; the
     regression ran on a shuffled series → RGI ("improving") on a machine going
     2.75 → 22.6 mm/s. Fixed: nvr_records.created_at (default now(), indexed)
     as secondary sort key. recorded_at stays the sequence truth.

CWRU RE-RUN on ba160b1-7 (each file on a fresh asset, single-file):
  97 → Zone B / Rolling Element 24 % · 105 → D / IR 14 % · 118 → D / BPFI 40 %
  (known misfire, hedged) · 130 (OR_007) → D / OR 25 % · 234 (OR_021) → D / OR
  18 %. All five identical to ba160b1-6. No regression.

Testing shortcut recorded: the 5-analysis limit is localStorage-only
(`ax_analysis_count`, `ax_tier`). `localStorage.removeItem('ax_analysis_count')`
resets it; `localStorage.setItem('ax_tier','pro')` lifts every free gate on
that browser (syncTier() overwrites it on load only when signed in). No code
change made for this.

Files changed: app.js, auth.js, org_of_one_v1.sql, nvr_records_created_at_v1.sql
(both utility — already run on prod), CONTEXT.md, DECISIONS.md (A16 + Part C).
Delete from working dir: DOCS_APPEND_session11.md (merged), rls_foundation.sql (v1).

Next session (in order):
  1. TREND-DIRECTION test: one asset, five files in worsening order
     (normal → OR_007 → Ball_007 → IR_007 → OR_021), five DISTINCT measurement
     dates a week apart, non-admin account. Expect PRA from reading 3, RUL falling.
  2. fleet.html: register path after the guard change; fetch helpers for A16.
  3. Audit one AI report for internal-governance leakage; RAG hygiene bundle.
  4. Fleet flow under RLS, Stripe wiring (Phase 1.5 continues).
  5. A14 measured-1× anchoring, A15 resolution guard — CWRU re-run after (A6).
```

Item 1 above was completed same day (see below) — pulled forward once the
trend fix (commits 3f59f45, 97ebc25) was verified working.

## Session Log — 4 Sep 2026 addendum — synthetic trend set 01 (outer race)

Ran the deferred trend-direction test same session: one asset (SYN-OR-01), six
weekly synthetic readings (7 Aug – 11 Sep), single outer-race defect growing
from nothing to Zone C, non-admin test account, distinct measurement dates.

RESULT: PASS on everything the test was built to check. Trend codes DDU, DDU,
PRA, PRA, PRA, PRA — matches the engine's own regression rule exactly. RUL
fell every reading (329 → 24 days). Top fault became Outer Race from reading
3 and strengthened monotonically (20% → 51%). Six points plotted in correct
date order on the trend chart, including one accidental same-day duplicate
(readings 3 and 4 both entered 21 Aug) — created_at tie-break handled it
correctly on real data, not just in isolated testing. Off-by-one fix confirmed:
reading 3 showed PRA, not DDU. Sample rate, shaft frequency (29.95 Hz) and all
four 6205 bearing frequencies auto-detected/computed correctly.

Zones landed one band low (A,A,A,B,B,C instead of intended A,A,B,C,C,D) — this
is a calibration bug in the synthetic-data generator (Session 11 scratch
script, not in the repo), not in the app. Direction and sequence were
unaffected either way.

THREE FINDINGS surfaced by having a working trend pipeline for the first time
(none are trend/scoring bugs — all AI-narrative or health-index issues; see
Not Started above for detail): baseline reading narrates a deviation from
itself; Zone A readings get "likely driver" fault language; health index
weighted toward indicative tier over zone. Plus a pre-existing but newly-
visible legibility problem: FFT and radar chart cards overlap/compress at
current size, confirmed from the results deck screenshots.

Session 12 brief written (NEXT_SESSION_BRIEF.md, not yet committed — merge
with any existing untracked brief of the same name in the repo folder):
Part 1 narrative-accuracy fixes (no CWRU re-run), Part 2 FFT/radar layout
(CSS only, verify before skipping CWRU re-run), Part 3 PRS/SCO trend states
+ corrected-calibration synthetic set 02.

