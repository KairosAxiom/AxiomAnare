# LynxEye — Living Project Context
Last updated: 20 Jul 2026
Latest code commit: 0df5503 (fleet gating) — index.html UI changes this
session are NOT yet committed; see Session Log below.
Company: Kairos Ventures Pte Ltd

---

## What this product is
LynxEye is an AI-augmented, ISO-ringfenced vibration diagnostic engine for
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
> rebranded to **LynxEye** (20 Jul 2026), but the **GitHub repo, the local disk
> folders, and the Supabase project ref were all deliberately kept unchanged** —
> so the names DON'T all say "LynxEye", and that is intentional, not drift:
>   - **Product / brand name:** LynxEye (what users, UI, reports, logo show)
>   - **GitHub repo:** still `AxiomAnare` → live URL `kairosaxiom.github.io/AxiomAnare`
>     (repo was NOT renamed; GitHub redirect + "only display name changed" decision)
>   - **Local folders:** still `AxiomAnare` — they match the *repo*, not the product.
>     Path `…\Kairos\AxiomAnare\axiomanare\AxiomAnare` — the triple-nesting is a
>     harmless clone artifact, not three different things.
>   - **Supabase project ref:** still `zjfhxutcvjxootoekade` (immutable; only the
>     dashboard *display label* was renamed to LynxEye).
>   - **Cloudflare worker:** still `restless-tree-eac8` (invisible; not renamed).
>
> **One-line map:** product = LynxEye · repo + folders = AxiomAnare · Supabase ref =
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

**Current palette: cream/light theme** (converted from dark navy 6 Jul 2026
— see Session Log). Example values: `--bg:#faf8f3`, `--surface:#ffffff`,
`--text:#1c1f26`, `--accent:#1f6fb2`. Full values live in index.html.

**Known governance gap (open, not yet remediated):** many colors in
index.html are hardcoded hex/rgba literals that do NOT reference the
`:root` variables — found during the 6 Jul conversion (43 hex + 71 rgba
literal instances outside the print stylesheet, several of them
near-duplicate colors of the actual variables, e.g. three different
"greens" were in simultaneous use). These were value-converted in place
during the 6 Jul light-theme pass so the visual result is coherent, but
they still aren't wired to `var()` — a future edit to `--green` etc. will
NOT automatically update them. A proper pass to replace these literals with
actual `var()` references is real cleanup debt, not done yet. Do not
introduce new hardcoded color literals going forward — always reuse the
variables.

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
- Maintain consistency across index.html, fleet.html, admin.html, and any
  new pages.
- Keep the engineering credibility of the product — no casual language in
  the UI. **No emojis in diagnostic output is the stated standard, but it
  is currently NOT enforced** — 17 emoji character entities are live in
  index.html (mgmt-icon, early-warning banner, buttons, etc.), confirmed by
  audit 6 Jul 2026. David has explicitly deferred cleanup until after the
  current heavy-lift work is done — this is a known, intentional exception,
  not an oversight. Do not silently "fix" it before then; do not forget it
  either — see Not Started.
- Respect the caveat, everywhere: AI output requires qualified engineer
  review and sign-off. It is a draft, not a certified determination.
- Update this file with decisions made in each chat; re-upload to Project
  Knowledge and commit to repo as a discrete closing step.
- Validate migrations in a sandbox Postgres instance before running on
  production.
- Verification-driven: want actual evidence (logs, query results,
  screenshots) before marking anything complete.
- Tight scope control: park out-of-scope ideas explicitly (see DECISIONS.md
  PART C for the rejected-patterns log) rather than building speculatively.

---

## Supabase
- Project: "Kairos Axiom" (FREE tier) / LynxEye / main (PRODUCTION)
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
The committed schema file (axiomanare_schema.sql) and the live DB have
diverged.
- Schema file defines 8 tables: organisations, assets, baselines, nvr_records,
  fault_detections, fault_signatures, zone_progressions, bearing_library.
- The 6 "sprint" tables (profiles, asset_twins, case_library, knowledge_chunks,
  usage_log, subscription_events) were created by an UNCOMMITTED migration
  (the 13 Apr "schema.sql utility script") — they exist in prod but are NOT
  in the committed schema file.
- fault_detections and zone_progressions are in the schema FILE but were
  NEVER created in prod. The live DB does not have them.
- Net live state = 6 from schema file (no fault_detections/zone_progressions)
  + 6 from the uncommitted migration = 12 tables.

### profiles columns (confirmed 22 May)
id (uuid PK), org_id (uuid), tier (tier_name enum),
subscription_status (subscription_status enum), stripe_customer_id (text),
stripe_sub_id (text), paypal_sub_id (text), asset_addon_count (int),
analyses_used (int), billing_interval (text), created_at, updated_at,
is_admin (boolean — ADDED 22 May by RLS migration)

### nvr_records columns (confirmed via 13 Apr migration)
feature_vector (jsonb), user_confirmed (boolean), confirmed_fault,
twin_deviation — plus base columns from the schema file. See DECISIONS
A10/A12 for planned/proposed additions not yet run on prod.

---

## RLS — ROW LEVEL SECURITY (hardened 22 May, verified on prod)
### Tenancy model
- Individual AND org based. An individual account = an org of one.
- Every profile points at an org_id. Customer data is org-scoped.
- An admin (profiles.is_admin = true) sees and manages everything.

### What rls_foundation_v2.sql installed (run on prod 22 May, success)
- Added profiles.is_admin boolean default false.
- Two SECURITY DEFINER helpers (SET search_path = public, granted to anon +
  authenticated + service_role): current_org_id(), is_admin().
- Column-guard trigger on profiles BEFORE UPDATE: blocks non-admin /
  non-service_role changes to tier, is_admin, org_id.
- Dropped all legacy open policies; installed org-scoped + admin policies.
- Migration is table-existence-aware — skips fault_detections /
  zone_progressions cleanly.
- WIPED pre-RLS test data (Option A): TRUNCATEd assets/baselines/nvr_records.

### Access summary
- profiles: own row or admin (privileged cols guarded by trigger).
- organisations: members read; member/admin update; authenticated insert;
  admin delete.
- assets / baselines / nvr_records: org-scoped or admin.
- fault_signatures / zone_progressions (cumulative silo, anonymised, shared
  cross-customer by design): authenticated insert + read; admin all.
- bearing_library: ANON READ preserved (free diagnostic needs it); admin write.
- asset_twins / case_library / knowledge_chunks / usage_log /
  subscription_events: admin-only (features not built yet).

### First admin bootstrapped
- davidlimyk@gmail.com → is_admin = true. Console (postgres role) does NOT
  bypass the column-guard trigger — bootstrap required temporarily disabling
  it. org_id likely NULL (created via Subscribe path) — fine for an admin.

### handle_new_user trigger — CONFIRMED working
Signup creates an auth.users row AND auto-creates a profiles row (tier=free,
is_admin=false).

---

## Tier Structure
| Tier          | Price   | Analyses  | Assets | AI Report | Fleet |
|---------------|---------|-----------|--------|-----------|-------|
| Free          | $0      | 5         | —      | ✗         | ✗     |
| Pro           | $49/mo  | Unlimited | —      | ✓         | ✗     |
| Fleet Starter | $99/mo  | Unlimited | 10     | ✓         | ✓     |
| Fleet Pro     | $299/mo | Unlimited | 30     | ✓         | ✓     |
| Asset add-on  | $25/mo  | —         | +1     | ✓         | ✓     |

Prices are hardcoded in the auth.js Subscribe modal — Stripe products must
match exactly once live. No upload caps on any paid tier; gate on assets
only. AI report is the primary freemium gate. Priced below expense claim
threshold — engineer pays own card. Replaces $200–$1,600/asset desk analysis
time, not the site visit. Engineer reviews + signs off all output; AI report
is a draft, not a certified determination.

---

## FREEMIUM GATE — Implementation Detail
```
FREE_ANALYSIS_LIMIT = 5 (app.js)
Free tier = anonymous, CLIENT-SIDE (localStorage counter). No Supabase
account, no profiles row. "Free to Try" is NOT a signup.

Freemium.isPro() → reads localStorage.ax_tier; any value other than 'free'
returns true; ax_pro legacy fallback if ax_tier absent.

Freemium.syncTier() [async] → called 200ms after auth.js loads →
window.Auth.getTier() → Supabase profiles.tier → caches ax_tier.

Auth.getTier() returns profile?.tier || 'free' → one of
'pro' | 'fleet_starter' | 'fleet_pro' | 'free' (never null)
```

### FLEET GATING — fleet.html (behind feature flag)
```
const FLEET_GATING_ENABLED = false   (fleet.html ~line 726)
  → DEFAULT OFF for stress testing. Flip to TRUE before launch.

fleet.html uses its OWN self-contained auth (raw fetch, localStorage.
ax_session) — no supabase-js session. Auth.getTier() would floor every
fleet user to 'free'. Fleet gating uses its own getUserTier() instead
(bearer-token sbGet on profiles).

OUT OF SCOPE (still open): asset-count enforcement (10/30), "upgrade an
existing logged-in user" Stripe flow.
```

---

## Payments
- Stripe: primary (account exists, keys TBC)
- PayPal: secondary (deferred until Stripe live)
- Products to create in Stripe: Pro, Fleet Starter, Fleet Pro, Asset Add-on

### Cloudflare Worker secrets required (dashboard → Settings → Variables)
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO,
STRIPE_PRICE_FLEET_STARTER, STRIPE_PRICE_FLEET_PRO

### Stripe webhook endpoint
URL: https://restless-tree-eac8.kairosventure-io.workers.dev/stripe-webhook
Events: checkout.session.completed, customer.subscription.deleted

---

## Cloudflare Worker — restless-tree-eac8
Dashboard-managed — no wrangler.toml, no CLI deploy, edited in CF dashboard.
| Route | Purpose |
|---|---|
| POST /v1/messages | Claude API proxy (streaming) |
| POST /embed | Voyage AI embeddings |
| POST /rag | Supabase match_knowledge_chunks |
| POST /create-checkout-session, /stripe-webhook | Stripe |
| CRON "0 9 */3 * *" | Supabase keep-alive ping |
Secrets bound: ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL,
VOYAGE_API_KEY (Stripe secrets still TODO).

### RAG Pipeline (live)
```
PDF/MD → chunk → embed (voyage-3, 1024-dim) → knowledge_chunks (pgvector)
→ at analysis: semantic query from NVR context → /embed → /rag → top-5
  chunks (0.30 similarity floor) → injected into Claude system prompt
```

---

## Completed Work (high-level — full history in Session Log)
Single/multi-channel diagnostic pipeline, PDF export, Fleet Dashboard,
agnostic file parser, RAG pipeline, Stripe integration (code, not live),
RLS foundation (applied to prod), admin bootstrap, CWRU benchmark, tier
gating on both index.html and fleet.html (fleet behind flag), Supabase
keep-alive cron (verified), KB at 192 chunks embedded.

## In Progress
- [ ] Admin dashboard (admin.html) — status not re-verified recently,
      don't assume "in progress" without checking
- [ ] Phase 1.5 stress testing (see Build Sequence)

## Not Started
- [ ] Fix README.md's stale live-app link
- [ ] Emoji cleanup in UI (17 instances) — explicitly deferred by David
      until after current heavy-lift work; tracked here so it isn't lost
- [ ] Color-literal-to-var() cleanup (see CSS variables governance gap above)
- [ ] Commit the 6 Jul UI changes (cream theme + KPI strip) to the repo —
      currently only exist as a local file David has, not yet pushed
- [ ] Digital twin Phase 1, ML feature extraction, case library population,
      email notifications, annual pricing logic, PayPal integration,
      Supabase Storage buckets, NASA IMS 3rd_test, KB Q1/Q3/Q4 reports,
      CAT 1 manual, CWRU 48kHz files, 6205-2RS bearing addition
- [ ] Data quality tiering (DECISIONS A10) and component-replacement trend
      reset (DECISIONS A11) — Phase 2, not urgent yet
- [ ] Mandatory input metadata / no silent defaults (DECISIONS A12) — now
      formalized in DECISIONS.md as of this session; implementation still
      not started. Known live gap: sample rate silently defaults to 1.0 kHz
      when omitted (found during Trrish1/Trrish2 CSV stress test).

---

## Build Sequence
```
PHASE 1 — Foundation                                   ✓ DONE (core)
PHASE 1.5 — Stress testing (coverage + accuracy)       ← current priority
├── Anonymous free-flow under RLS
├── Fleet flow under RLS
├── Diagnostic accuracy vs CWRU labelled benchmark
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
| index.html | Main diagnostic app — cream/light theme as of 6 Jul 2026 |
| app.js | Diagnostic engine, Freemium object |
| auth.js | Shared auth module |
| fleet.html | Fleet dashboard (own auth; gating behind flag) |
| admin.html | Admin dashboard — status unverified, don't assume built |
| agnosticParser2.js, multiChannel.js | Parser + multi-channel logic |
| axiomanare-proxy.js | CF Worker source |
| rls_foundation_v2.sql | RLS migration (utility, keep for record) |

---

## Session Log — 2 Jul 2026 (Ops — repo ownership correction)
```
- Hit a live 404 at esimconnect.github.io/AxiomAnare while resuming stress
  testing. Traced: github.com/esimconnect/AxiomAnare redirects to the real
  owner, github.com/KairosAxiom/AxiomAnare. esimconnect was never the true
  owner — a stale name propagated from an old saved Project Instructions
  draft into CONTEXT.md and ARCHITECTURE.md.
- README.md points to a third, also-dead URL (limykdavid-maker.github.io/
  axiomanare) — separate open task.
- Confirmed real working URL: https://kairosaxiom.github.io/AxiomAnare
Next session should: fix README's stale link; once new sensor CSV is
available, sanity-check it before running through the live app; re-verify
admin.html's actual state before assuming any status.
```

## Session Log — 6 Jul 2026 (UI — cosmetic theme conversion, cross-project
## confusion resolved, doc drift corrected)
```
Completed this session:
  - Cross-project mixup caught and resolved: a Cloudflare Pages link
    (axiomsensa-frontend.pages.dev) initially presented as "the last link
    we used" for LynxEye turned out to belong to a genuinely separate
    project, AxiomSensa. Confirmed by David: AxiomSensa and Juzgo (formerly
    eSimconnect) are two other, distinct projects with their own project
    folders — not to be conflated with LynxEye again. This also explains
    the historical "esimconnect" org name: it was this project's actual old
    repo home before the three projects were split into separate folders,
    not a random wrong guess.
  - Reviewed an externally-built UI mockup (different AI platform) the
    person was evaluating as inspiration. On inspection it had no real
    functionality — upload handler never parsed files, all charts were
    hardcoded/randomized canvas draws, a "40+ vendor format" claim had zero
    parsing code behind it. Flagged as a design-only reference, not
    something with substance to port.
  - Of four UI patterns drafted from that reference (asset tree, tabbed
    chart switcher, KPI strip, per-chart metrics strip), audited the REAL
    index.html before building anything further and found two were already
    implemented, better: the Fault Severity Radar chart (ISO 13379-1 cited)
    and detailed per-chart metrics (FFT legend, fault-classification bars,
    driving-feature readout, RUL confidence interval) already exist.
  - Implemented, against the real index.html:
    1. KPI glance strip — new row (Health Index / Overall Vibration / ISO
       Zone / Diagnostic Confidence) added above the existing Management
       Summary Card, not replacing it. Uses "—" placeholders matching the
       file's existing convention; no values invented. IDs: kpi-health,
       kpi-vib, kpi-zone, kpi-conf (+ -trend/-sub/-tier companions) — need
       wiring in app.js's existing render function.
    2. Full color-scheme conversion, dark navy → cream/light. Converted all
       16 :root variables plus 43 hardcoded hex literals and 71 rgba()
       literals found OUTSIDE the variables (pre-existing drift — several
       were near-duplicate colors of the real variables, e.g. three
       different "greens" in simultaneous use: --green, a value in
       .mgmt-card.green, and a third in the print stylesheet). The print
       stylesheet (@media print, lines ~313–486) was deliberately left
       untouched — already correctly light-themed for printed reports.
    3. Verified: extracted all 4 inline <script> blocks, ran `node --check`
       on each — all pass, no syntax breakage from the conversion.
  - Corrected the documented CSS variable count from 10 to the actual 16.
  - Audited emoji usage: 17 HTML character entities present in the live UI
    (mgmt-icon, early-warning banner, buttons, etc.), directly against the
    documented "no emojis in diagnostic output" standard. NOT fixed this
    session — David explicitly asked to defer cleanup until after current
    heavy-lift work, logged here so it's tracked, not forgotten.
  - Caught, twice more, the same stale saved Project Instructions draft
    being pasted in (esimconnect, "2 analyses," tables marked "planned"
    that are live, 10-var CSS list). Also caught: the DECISIONS.md
    re-uploaded this session was an older version missing A10, A11, and
    the Part C rejected-patterns log that the 19 Jun session had already
    added — used the fuller existing version as the base instead.
  - Formalized DECISIONS A12 for real (mandatory input metadata, no silent
    defaults) — it had been referenced as "proposed" in STATUS.md,
    ARCHITECTURE.md, and the stress-test manifest for weeks but was never
    actually written into DECISIONS.md's guardrails list. Fixed.

Files changed:
  - index.html (color scheme + KPI strip) — NOT YET COMMITTED, exists only
    as a file David has locally from this session; push it to the repo.
  - CONTEXT.md (this rewrite)
  - DECISIONS.md (formalized A12; added Part B/C entries for the color
    governance drift finding and the emoji-deferral decision)

Latest code commit: 0df5503 (unchanged — this session's index.html edit is
not yet pushed)

Next session should:
  - Commit the new index.html to the repo (color scheme + KPI strip).
  - Wire the new kpi-* element IDs to real computed values in app.js.
  - Resume Phase 1.5 stress testing priorities from the 2 Jul handoff.
  - When doing later housekeeping: fix the 17 emoji instances, and consider
    a pass replacing hardcoded color literals with proper var() references.
```

## Session Log — 20 Jul 2026 (Rebrand — AxiomAnare → LynxEye)
```
Product renamed AxiomAnare → LynxEye (display name only). Trademark + domain
(lynxeye.io) cleared by David before starting. Precedent: the earlier
esimconnect → Juzgo rename, which was also a display-name change (same GitHub
repo kept, same Supabase project ref, only the human-readable label flipped).

Scope decision — DISPLAY NAME ONLY. Internal identifiers deliberately NOT
touched (renaming them is user-invisible and breaks live state):
  - Supabase project ref zjfhxutcvjxootoekade (immutable) — only the dashboard
    DISPLAY label should be renamed to LynxEye (do this in Supabase UI; not a
    code change). Ref, anon key, all connection strings unchanged.
  - localStorage keys ax_tier / ax_pro / ax_analysis_count / ax_channels /
    ax_hz / ax_output_tokens / ax_tokens — kept (renaming logs out all users,
    resets free counters).
  - axiomPrint() function + its onclick caller in index.html — kept.
  - Cloudflare Worker restless-tree-eac8 + PROXY_BASE — kept (worker names are
    invisible; confirmed restless-tree-eac8 is the LIVE proxy via PROXY_BASE in
    app.js — the other two workers claude-proxy and axiomanare-proxy are NOT
    referenced; axiomanare-proxy is stale, safe to delete later).
  - GitHub repo kept as AxiomAnare (NOT renamed) → live URL stays
    kairosaxiom.github.io/AxiomAnare. If repo is later renamed or lynxeye.io
    custom domain is added, that's a follow-up (update URLs + Supabase Auth
    redirect allow-list + Worker CORS + Stripe success/cancel URLs then).

Code changes (all 4 files pass node --check; inline <script> blocks re-checked):
  - index.html: title, print footers (@page + data-filename), print
    disclaimer, header wordmark (now Lynx #7bbde8 light / Eye #1f6fb2 dark —
    colors FLIPPED from old Axiom-dark/Anare-light), persona label
    "LynxEye Assist", AND the nav logo: the old gray-gears + green-scope-wave
    <canvas id="nav-logo"> animation was REPLACED with an inline animated SVG
    of the new eye+2-gears mark (same id, so the L270/L290 responsive CSS still
    applies; reduced-motion freeze included). Dead canvas <script> block removed.
  - app.js: upgrade-modal wordmark, RAG-prompt product name, AI system-prompt
    persona ("You are LynxEye Assist"), free-trial watermark, report print
    header (ph-name), dev comment. axiomPrint kept.
  - fleet.html: title, 2× login-app-name, fleet-nav-name.
  - admin.html: title, 2× headings, body text.
  - AI persona AxiomAssist → "LynxEye Assist" (report header + system prompt).

Logo assets produced (in outputs, need adding to repo):
  - lynxeye-logo.svg (animated, prefers-reduced-motion freeze) — web/login use
  - lynxeye-logo-static.svg (gears frozen mid-mesh) — print/PDF/favicon use
  Mark = open almond eye (two light-blue lid strokes) + two dark-blue gears
  meshing at true pitch distance, wordmark Lynx(light)/Eye(dark) beneath.

Docs (this pass): product name → LynxEye in live prose across CONTEXT /
DECISIONS / STATUS / ARCHITECTURE / DEPLOY_CHECKLIST. Preserved as-is: all
esimconnect "don't use this name" warnings, the 404-incident history, the
stale-README-link debt notes, session logs. Corrected 3 stale live URLs
(esimconnect.github.io → kairosaxiom.github.io) + the stale repo-owner line in
ARCHITECTURE (was esimconnect, now KairosAxiom). Local disk paths
(D:/E:\Kairos\AxiomAnare\...) and filenames (axiomanare_schema.sql,
axiomanare-proxy.js) kept — those are real folder/file names, not the product.

STILL OPEN / next session:
  - Rename the Supabase project DISPLAY label to LynxEye in the dashboard
    (30-sec UI action, ref untouched — same as was done for Juzgo).
  - Fix README.md's stale live link (limykdavid-maker... 404) — README not in
    this project bundle, do it in the repo directly.
  - Add lynxeye-logo.svg / -static.svg to the repo; wire favicon to the static
    one; point print/PDF header at the static SVG if desired.
  - Branch + DEPLOY_CHECKLIST pass before merging to main. No diagnostic/FFT/
    scoring logic changed, so CWRU re-run not strictly required, but eyeball one
    generated AI report to confirm "LynxEye Assist" renders and streaming works
    (persona change touches the AI prompt path).
  - Decide later: rename GitHub repo + add lynxeye.io custom domain (with the
    Auth/CORS/Stripe redirect updates that entails).
```
