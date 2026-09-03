# LynxEyes — Living Project Context
Last updated: 2 Sep 2026
Latest code commit: bac213c (bearing-only card branch + buildFallback two-tier language).
  Scorer arc commits this session: 8570d6a → ba160b1 → d2cc7bd → bac213c.
  Debug logging (BER-DEBUG console.log) still live in app.js — remove before embed pass.
  KB chunks committed 5aa2904 (repo-only), embed still deferred — see Next session.
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
First admin bootstrapped: davidlimyk@gmail.com.

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
KB at 192 chunks embedded. Two-tier output model (A13) implemented and
verified against CWRU Normal + Ball_007 files (2 Sep 2026).

## In Progress
- [ ] Admin dashboard (admin.html) — status not re-verified recently
- [ ] Phase 1.5 stress testing (see Build Sequence)
- [ ] Remove BER-DEBUG console.log from app.js before next embed pass

## Not Started
- [ ] Fix README.md's stale live-app link
- [ ] Embed 9 KB chunks (5aa2904 repo-only) — deferred until BER-DEBUG removed
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
- [ ] Phase 1.5 stress testing: free-flow under RLS (incognito), fleet flow,
      Stripe wiring, close small bugs (count-of-1 badge pluralisation)
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
