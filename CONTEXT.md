# AxiomAnare — Living Project Context
Last updated: 22 May 2026
Latest code commit: 0df5503 (fleet gating)
Company: Kairos Ventures Pte Ltd

---

## Repository
- Repo: https://github.com/esimconnect/AxiomAnare (org: esimconnect)
- Live: https://esimconnect.github.io/AxiomAnare
- Local: D:\Kairos\AxiomAnare\axiomanare\AxiomAnare (drive letter may vary D: or E:)
- Git: `cd /d/Kairos/AxiomAnare/axiomanare/AxiomAnare` then standard git add/commit/push
- Branch: main
- Stable tag: v1.0-stable — commit 4ef5762

## Supabase
- Project: "Kairos Axiom" (FREE tier) / AxiomAnare / main (PRODUCTION)
- URL: https://zjfhxutcvjxootoekade.supabase.co
- Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmh4dXRjdmp4b290b2VrYWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjgzODAsImV4cCI6MjA5MDcwNDM4MH0.5yGgSjALJhTQm5Ud3W-fU2Bgo-3PkziaS0oLrGMYQ9o
  (note: fleet.html / index.html also reference a publishable key sb_publishable_lM8rmd2rwRo3-XXW_iOy2A_28Zinsh8)
- pgvector: enabled
- Keep-alive: Cloudflare Worker cron "0 9 */3 * *" — VERIFIED firing (see 18/22 May logs)

### LIVE TABLES (12 — confirmed via Table Editor 22 May)
asset_twins, assets, baselines, bearing_library, case_library,
fault_signatures, knowledge_chunks, nvr_records, organisations,
profiles, subscription_events, usage_log

### SCHEMA DRIFT — IMPORTANT
The committed schema file (axiomanare_schema.sql) and the live DB have diverged.
- Schema file defines 8 tables: organisations, assets, baselines, nvr_records,
  fault_detections, fault_signatures, zone_progressions, bearing_library.
- The 6 "sprint" tables (profiles, asset_twins, case_library, knowledge_chunks,
  usage_log, subscription_events) were created by an UNCOMMITTED migration
  (the 13 Apr "schema.sql utility script") — they exist in prod but are NOT in
  the committed schema file.
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
- NOTE: the Stripe column is `stripe_sub_id`, NOT `stripe_subscription_id` as
  earlier CONTEXT "pending" items wrongly stated. Both Stripe columns already
  exist in prod — the "ADD COLUMN" pending item is effectively DONE.

---

## RLS — ROW LEVEL SECURITY (hardened 22 May, verified on prod)
Earlier CONTEXT claimed RLS was "hardened and tested." That was INCORRECT — the
live DB carried open "USING (true)" beta policies and organisations was flagged
UNRESTRICTED. This was closed on 22 May by rls_foundation_v2.sql.

### Tenancy model
- Individual AND org based. An individual account = an org of one.
- Every profile points at an org_id. Customer data is org-scoped.
- An admin (profiles.is_admin = true) sees and manages everything.

### What rls_foundation_v2.sql installed (run on prod 22 May, success)
- Added profiles.is_admin boolean default false.
- Two SECURITY DEFINER helpers (SET search_path = public, granted to anon +
  authenticated + service_role):
    current_org_id() -> the caller's org
    is_admin()       -> whether caller is admin
- Column-guard trigger guard_profile_privileged_cols() on profiles BEFORE
  UPDATE: blocks non-admin / non-service_role changes to tier, is_admin, org_id.
  Exempts auth.role() = 'service_role' so the Stripe webhook can still set tier.
- Dropped all legacy open policies; installed org-scoped + admin policies.
- Migration is TABLE-EXISTENCE-AWARE (one DO block) — only touches tables that
  exist, so it matches the drifted live DB and skips fault_detections /
  zone_progressions cleanly.
- WIPED pre-RLS test data (Option A): TRUNCATEd assets/baselines/nvr_records
  (fault_detections absent). Reference/silo data preserved (bearing_library,
  fault_signatures seed).

### Policy counts confirmed on prod (per table)
profiles 4, organisations 4, bearing_library 2, fault_signatures 2,
assets / baselines / nvr_records / asset_twins / case_library /
knowledge_chunks / usage_log / subscription_events = 1 each.

### Access summary
- profiles: own row or admin (privileged cols guarded by trigger).
- organisations: members read; member/admin update; authenticated insert;
  admin delete.
- assets / baselines / nvr_records: org-scoped (baselines & nvr scoped through
  parent asset's org) or admin.
- fault_signatures / zone_progressions (CUMULATIVE SILO, anonymised, shared
  cross-customer by design): authenticated insert + read; admin all.
- bearing_library: ANON READ preserved (free diagnostic needs it); admin write.
- asset_twins / case_library / knowledge_chunks / usage_log /
  subscription_events: ADMIN-ONLY (features not built yet; refine when built).
  RAG reads go via SECURITY DEFINER match fn which bypasses RLS.

### First admin bootstrapped (22 May)
- davidlimyk@gmail.com promoted to is_admin = true.
- NOTE: the console (postgres role) does NOT bypass the column-guard trigger.
  Bootstrap required temporarily disabling the trigger:
    ALTER TABLE public.profiles DISABLE TRIGGER trg_guard_profile_privileged_cols;
    UPDATE public.profiles SET is_admin = true WHERE id = (...);
    ALTER TABLE public.profiles ENABLE TRIGGER trg_guard_profile_privileged_cols;
- davidlimyk@gmail.com was created via the Subscribe path, so its org_id is
  likely NULL. Fine for an admin (sees all via is_admin()), but note it has no
  org attached.

### handle_new_user trigger — CONFIRMED working
Signup creates an auth.users row AND auto-creates a profiles row (tier=free,
is_admin=false). Verified 22 May with davidlimyk@gmail.com.

### RLS validation method
rls_foundation_v2.sql was validated in a sandbox Postgres 16 against a faithful
12-table replica before running on prod. Behavioural tests passed: cross-org
isolation, self-escalation blocked by trigger, service_role/webhook tier update
works (with BYPASSRLS), admin cross-org visibility, anon bearing_library read
preserved, anon customer-data locked. Two GRANT bugs were caught and fixed in
testing (helpers needed EXECUTE for service_role + anon, not just authenticated)
— this is the validated v2.

---

## Completed Work
- [x] Single-channel diagnostic pipeline
- [x] Multi-channel diagnostic pipeline
- [x] PDF export
- [x] Fleet Dashboard (auth, RLS, baseline + batch upload)
- [x] Fleet detail panel
- [x] Agnostic file parser (CSV, MAT, XLSX, JSON, TSV)
- [x] Nav: Free to Try, Subscribe, Login, Fleet Dashboard buttons
- [x] Animated canvas logo in nav (gears + green wave)
- [x] Responsive layout — tablet (≤900px) + mobile (≤600px)
- [x] ML label maps: cwru, nasa_ims, epson
- [x] CWRU .mat dataset download — 109 files
- [x] KB/Standards: ISO_10816_Chart_colour.pdf
- [x] KB/Reports: K394-11 + Reports 001–009 + CM_SiteA/B/C (8 files)
- [x] KB/Reference: Nagahama_2025, CWRU README, CWRU_Dataset_Overview,
      VCAT_Reference_Material
- [x] KB/Manuals: SKF_Bearing_Installation_Guide, SKF_Bearing_Maintenance_Handbook
- [x] NASA IMS 1st_test (2,156) + 2nd_test (984); Epson trimmed (96)
- [x] Supabase schema — all tables (note drift, above)
- [x] auth.js shared module — signUp, signIn, signOut, getSession, getTier,
      getProfile, incrementAnalysesUsed, tierAnalysisLimit
- [x] Auth + Subscribe modal — Login tab + Subscribe tab with tier cards
- [x] RAG pipeline — Cloudflare Worker /embed + /rag routes
- [x] app.js — ragQuery(), buildRagContext(), streamClaude() with KB injection
- [x] match_knowledge_chunks — SECURITY DEFINER, pgvector tested
- [x] Total KB: 192 chunks embedded (voyage-3)
- [x] Stripe Checkout integration — Worker /create-checkout-session route
- [x] Stripe webhook — Worker /stripe-webhook route (HMAC-SHA256, no external lib)
- [x] auth.js — _doSignup() Stripe redirect, _handlePaymentReturn(), toast
- [x] Landing page (landing.html)
- [x] Baseline prompt toast — Zone A/B post-analysis
- [x] DC + linear detrend (ISO 13373-2:2016 §7.2)
- [x] Spectral velocity RMS via Parseval (ISO 10816-3 §4.2)
- [x] BSF 4-path detection
- [x] CWRU benchmark 5/5
- [x] FREE_ANALYSIS_LIMIT = 5 (app.js)
- [x] Tier gating — index.html (Freemium.syncTier() wired to Auth.getTier())
- [x] Supabase keep-alive — CF Worker scheduled() cron "0 9 */3 * *" — VERIFIED
- [x] Tier gating — fleet.html (behind FLEET_GATING_ENABLED flag, default off) — 22 May
- [x] Stripe profiles columns (stripe_customer_id, stripe_sub_id) — already in prod
- [x] RLS FOUNDATION — org-scoped + admin, helpers, escalation trigger,
      test-data wipe (rls_foundation_v2.sql, run on prod) — 22 May
- [x] profiles.is_admin column + first admin bootstrapped — 22 May
- [x] handle_new_user signup trigger confirmed firing — 22 May

## In Progress
- [ ] Admin dashboard (admin.html) — NEXT (RLS foundation now in place)

## Pending — Stripe go-live (code done, not live)
- [x] Supabase profiles stripe columns — DONE (already present, stripe_sub_id)
- [ ] Cloudflare Worker: add 5 secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_PRO, STRIPE_PRICE_FLEET_STARTER, STRIPE_PRICE_FLEET_PRO)
- [ ] Stripe Dashboard: create 4 products + prices, register webhook endpoint
- [ ] Redeploy Worker after adding secrets
- [ ] Test full Stripe flow with sk_test_ keys + card 4242 4242 4242 4242
- [ ] Live error currently seen: "No Stripe Price ID configured for tier: pro"
      (expected until secrets/products exist)

## Known Issues / Corrections (surfaced 22 May)
- [ ] auth.js tierAnalysisLimit() returns 2 for free — STALE, real limit is 5
      (app.js). Reconcile (auth.js line ~76).
- [ ] Pluralisation: badge reads "N free analyses left". "analyses" is correct
      for plural, but at count=1 it should say "1 free analysis". Check
      updateFreeBadge() pluralises (count===1 ? 'analysis' : 'analyses').
- [ ] PRICE RECONCILIATION: Subscribe modal in auth.js shows HARDCODED prices
      (Pro $49, Fleet Starter $99, Fleet Pro $299) even though CONTEXT pricing
      was "deferred/TBD". Stripe products MUST be created with these exact
      prices or displayed vs charged price will disagree.
- [ ] Verify free-flow RLS impact: does the LOGGED-OUT free diagnostic write to
      nvr_records or fault_signatures? Those are now locked to authenticated/
      org-scoped. If the free flow writes there, those writes will fail and need
      a scoped anon exception. Bearing lookup (anon read) is preserved, so the
      core diagnostic should be fine.
- [ ] RLS app-impact: fleet.html/app.js may have relied on old open access.
      First post-RLS stress test is also the test of whether the app respects
      its own RLS.

## Not Started
- [ ] Digital twin Phase 1
- [ ] ML feature extraction (CWRU/NASA)
- [ ] Case library population
- [ ] Email notifications
- [ ] Annual pricing / discount logic
- [ ] PayPal integration (deferred — after Stripe is live)
- [ ] Supabase Storage buckets (ml-raw-signals, knowledge-base)
- [ ] NASA IMS 3rd_test (ZIP corrupt, deferred)
- [ ] KB/Reports: Q1, Q3, Q4 2023 quarterly reports (pending upload)
- [ ] KB/Manuals: CAT 1 manual (pending)
- [ ] CWRU 48 kHz drive end files (deferred)
- [ ] 6205-2RS bearing → add to bearing_library
- [ ] fault_detections / zone_progressions — decide whether to create in prod
      (in schema file, not in live DB; RLS migration skips them)

---

## Tier Structure
| Tier          | Price   | Analyses  | Assets | AI Report | Fleet |
|---------------|---------|-----------|--------|-----------|-------|
| Free          | $0      | 5         | —      | ✗         | ✗     |
| Pro           | $49/mo  | Unlimited | —      | ✓         | ✗     |
| Fleet Starter | $99/mo  | Unlimited | 10     | ✓         | ✓     |
| Fleet Pro     | $299/mo | Unlimited | 30     | ✓         | ✓     |
| Asset add-on  | $25/mo  | —         | +1     | ✓         | ✓     |

- Prices above are HARDCODED in the auth.js Subscribe modal (confirmed live).
  Stripe products/prices must match these exactly.
- No upload caps on any paid tier; gate on assets only.
- Annual: 2 months free (pay 10, get 12) — logic not built.
- AI report is the primary freemium gate.
- Pricing philosophy: below expense claim threshold — engineer pays own card.
- Replaces $200–$1,600/asset desk analysis time, NOT the site visit. Engineer
  reviews + signs off all output. AI report is a draft, not a certified
  determination.

---

## FREEMIUM GATE — Implementation Detail
```
FREE_ANALYSIS_LIMIT = 5 (app.js)
Free tier = anonymous, CLIENT-SIDE (localStorage counter). No Supabase account,
no profiles row. "Free to Try" is NOT a signup.

Freemium.isPro()
  → reads localStorage.ax_tier (written by syncTier())
  → any value other than 'free' returns true
  → ax_pro legacy fallback if ax_tier absent

Freemium.syncTier() [async]
  → called 200ms after auth.js loads (index.html inline script)
  → window.Auth.getTier() → Supabase profiles.tier → caches ax_tier
  → if paid: removes watermark, trial banner, upgrade modal, PDF lock

Auth.getTier() returns profile?.tier || 'free'
  → one of 'pro' | 'fleet_starter' | 'fleet_pro' | 'free' (never null)
```

### FLEET GATING — fleet.html (22 May, behind feature flag)
```
const FLEET_GATING_ENABLED = false   (fleet.html ~line 726)
  → DEFAULT OFF for stress testing — any authenticated user reaches dashboard.
  → Flip to TRUE before launch to enforce fleet-tier-only access.

CRITICAL: fleet.html uses its OWN self-contained auth (raw fetch to
/auth/v1/token, _session + localStorage.ax_session). It does NOT establish a
supabase-js session. So Auth.getTier() (which reads via the supabase-js client)
would floor every fleet user to 'free' and lock out paying subscribers.
THEREFORE fleet gating uses its own getUserTier() — reads profiles.tier via
fleet's bearer-token sbGet, same pattern as loadUserOrg() reading organisations.

When enabled:
  - getUserTier() reads profiles.tier (bearer token, not Auth.getTier())
  - isFleetTier() = fleet_starter | fleet_pro only
  - enforceFleetGate() gates BOTH entry points (fresh login + session restore)
    before showApp()
  - free/pro users → #upgrade-screen overlay (reuses login-card styling),
    CTA opens Auth.openModal('subscribe'), plus sign-out
  - doLogout() also clears the upgrade overlay

OUT OF SCOPE (still open):
  - Asset-count enforcement (Fleet Starter 10 / Fleet Pro 30) — separate from
    access gating, not built.
  - "Upgrade an existing logged-in user" Stripe flow — belongs to Stripe
    go-live; subscribe modal currently does signup-then-checkout.

PRE-LAUNCH (when enabling): flip flag → true; test fleet_starter PASSES, test
pro/free gets BLOCKED — validates the profiles RLS self-read.
```

---

## Payments
- Stripe: primary (account exists, keys TBC)
- PayPal: secondary (deferred — after Stripe live; paypal_sub_id column exists)
- Currency: USD primary, local via Stripe/PayPal auto
- Billing: monthly auto-renew, cancel anytime
- Products to create in Stripe (with prices above): Pro, Fleet Starter,
  Fleet Pro, Asset Add-on

### Cloudflare Worker secrets required (Worker → Settings → Variables → Secrets)
| Secret | Value |
|--------|-------|
| STRIPE_SECRET_KEY          | sk_live_… (or sk_test_…) |
| STRIPE_WEBHOOK_SECRET      | whsec_… |
| STRIPE_PRICE_PRO           | price_… (Pro monthly) |
| STRIPE_PRICE_FLEET_STARTER | price_… (Fleet Starter monthly) |
| STRIPE_PRICE_FLEET_PRO     | price_… (Fleet Pro monthly) |

### Stripe webhook endpoint
- URL: https://restless-tree-eac8.kairosventure-io.workers.dev/stripe-webhook
- Events: checkout.session.completed, customer.subscription.deleted

---

## Cloudflare Worker — restless-tree-eac8
- Account: kairosventure.io@gmail.com
- URL: restless-tree-eac8.kairosventure-io.workers.dev
- Routes:
    POST /v1/messages              — Claude API proxy (ANTHROPIC_API_KEY)
    POST /embed                    — Voyage AI embeddings (VOYAGE_API_KEY)
    POST /rag                      — Supabase match_knowledge_chunks (SUPABASE_SERVICE_KEY)
    POST /create-checkout-session  — Stripe Checkout (STRIPE_SECRET_KEY + PRICE_*)
    POST /stripe-webhook           — Stripe events (STRIPE_WEBHOOK_SECRET)
    CRON "0 9 */3 * *"             — Supabase keep-alive ping (scheduled())
- Secrets bound: ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL,
  VOYAGE_API_KEY (Stripe secrets still TODO)
- Keep-alive VERIFIED 22 May: log "keepalive 200 @ 2026-05-19T09:00:11.867Z",
  0 errors, firing on schedule (09:00 UTC). Workers Logs enabled in Observability.

### RAG Pipeline (live)
```
PDF/MD → chunk → embed (voyage-3, 1024-dim) → knowledge_chunks (pgvector)
→ at analysis: semantic query from NVR context → /embed → /rag → top-5 chunks
  (0.30 similarity floor) → injected into Claude system prompt → grounded report
```

---

## ML + Knowledge Base Strategy

### Data Sources
| Source                  | Type | Fault Coverage           | Status     |
|-------------------------|------|--------------------------|------------|
| CWRU dataset            | MAT  | BPFO, BPFI, BSF          | ✓ Complete |
| NASA IMS 1st/2nd_test   | MAT  | RUL / run-to-failure     | ✓ Complete |
| NASA IMS 3rd_test       | MAT  | RUL                      | ✗ Deferred |
| Epson field data        | CSV  | Mixed field faults       | ✓ Complete |
| K394-11 field report    | PDF  | Imbalance (confirmed)    | ✓ Uploaded |
| Reports 001–006         | PDF  | Anonymised field cases   | ✓ Uploaded |
| Reports 007–009         | MD   | Pharma plant, Apr 2023   | ✓ Complete |
| CM Site summaries (8)   | MD   | AHU/UTY/MFG/TankFarm/WWTP| ✓ Complete |
| ISO 10816 CMVA guide    | PDF  | Zone thresholds          | ✓ Uploaded |
| Nagahama 2025           | PDF  | Phase fault diagnosis    | ✓ Uploaded |
| CWRU README / Overview  | PDF/MD| Bearing dataset ref     | ✓ Complete |
| VCAT_Reference_Material | MD   | Fault spectra, ISO, FFT  | ✓ Complete |
| SKF Install / Handbook  | MD   | Symptom/cause, RCA       | ✓ Complete |
| Reports Q1/Q3/Q4        | MD   | Pharma plant 2023        | Pending    |
| CAT 1 manual            | PDF  | All fault types          | Pending    |

### KB Reports — Content Summary
| Report | Assets | Key Faults |
|--------|--------|------------|
| 001–006 | Various | Mixed field cases |
| 007 | 24 AHUs — pharma | Misalignment/beat (Danger), bearing freq (Alert), unbalance (Warning) |
| 008 | 15 Tank Farm — pharma | Early bearing fault (demod elevated, velocity normal) |
| 009 | 2 Booster pumps — pharma | Clean baseline — healthy reference |

### KB Report Anonymisation Rules
Client→[CLIENT], Plant/site→[SITE-A/B/C], Address→[SITE ADDRESS],
Contact→[CLIENT CONTACT], Provider→[SERVICE PROVIDER], Ref#→[REPORT-REF].
Keep: asset tag numbers, process area descriptions (diagnostically relevant).

### CWRU Dataset Folder Structure
```
Data_Sets/cwru/
├── normal/   normal_0hp..3hp.mat
├── drive_end/ IR/B/OR (all sizes + loads + 3 OR positions)
└── fan_end/   IR/B/OR
```
- Label map: ML/Labels/cwru_label_map.json (filenames match exactly).
- Taxonomy: inner_race→BPFI, ball→BSF, outer_race→BPFO.
- Validated against independent academic review (CWRU_Dataset_Overview.md).

### ML Pipeline (planned)
1. Supabase Storage buckets  2. Bulk upload CWRU/NASA  3. Feature extraction
4. Label by fault type  5. Train classifier (target: 12 months post-launch)

---

## Key Decisions Log
| Date     | Decision                                            | Rationale |
|----------|-----------------------------------------------------|-----------|
| Apr 2026 | Stripe primary, PayPal secondary                    | Existing account, best docs |
| Apr 2026 | PayPal deferred until Stripe live                   | Reduce scope, ship faster |
| Apr 2026 | No upload caps on paid tiers                        | Gate on assets only |
| Apr 2026 | pgvector in Supabase (not separate vector DB)       | Single platform |
| Apr 2026 | CONTEXT.md as cross-chat bridge                     | Projects don't share chat history |
| Apr 2026 | Digital twin Phase 1 for Fleet on launch            | Justifies Fleet price |
| Apr 2026 | ML: collect now, train at 12 months                 | Need labelled volume first |
| Apr 2026 | Site visit still required (AI drafts, engineer signs)| Liability / credibility |
| Apr 2026 | CWRU descriptive filenames + flat drive/fan folders  | Matches label map |
| Apr 2026 | NASA IMS 3rd_test deferred                          | ZIP corrupt, no Kaggle |
| Apr 2026 | KB reports 1/quarter, .md not .docx                 | Diminishing returns; RAG-ready |
| Apr 2026 | auth.js IIFE, window.Auth API; modal built in JS    | Matches Freemium pattern; works on fleet too |
| Apr 2026 | Signup creates Supabase acct then → Stripe          | Clean auth vs payment split |
| Apr 2026 | Stripe client_reference_id = Supabase user UUID      | Links payment to profile in webhook |
| Apr 2026 | Webhook HMAC-SHA256 via SubtleCrypto                | No external lib in CF Worker |
| Apr 2026 | Default tier = Pro in Subscribe modal               | Lowest-friction conversion |
| Apr 2026 | Responsive breakpoints 900/600                      | iPad + phone |
| Apr 2026 | FREE_ANALYSIS_LIMIT = 5 (was 2)                     | Confirmed in app.js |
| Apr 2026 | Freemium.isPro() reads ax_tier; syncTier 200ms delay | Supabase session restore first |
| May 2026 | Supabase keep-alive via CF Worker cron (not GH Actions)| Worker already has SERVICE_KEY |
| May 2026 | Cron "0 9 */3 * *"; query GET /assets?limit=1       | Margin under 7-day pause; minimal payload |
| May 2026 | Avoid */N cron in JSDoc blocks                      | "*/" terminates /** */ |
| 22 May   | Fleet gating behind FLEET_GATING_ENABLED, default off| Stress testing needs open access; 1-line flip at launch |
| 22 May   | Fleet gating uses own getUserTier(), NOT Auth.getTier()| fleet.html has no supabase-js session; Auth path would lock out paid users |
| 22 May   | Tenancy: individual = org of one                    | One model covers both account types |
| 22 May   | SECURITY DEFINER helpers (current_org_id, is_admin) | Avoid RLS recursion on profiles |
| 22 May   | Column-guard trigger exempts service_role           | Webhook must still set tier; trigger fires regardless of RLS |
| 22 May   | Helpers granted to anon+authenticated+service_role  | Bug found in test: missing grant broke webhook + anon |
| 22 May   | Migration table-existence-aware (DO block)          | Live DB drifted; skip missing tables (fault_detections etc.) |
| 22 May   | Wipe pre-RLS test data (Option A)                   | Orphan rows had no real org; clean slate for stress testing |
| 22 May   | Cumulative silo (fault_signatures/zone) = shared    | Anonymised cross-customer by design, not org-scoped |
| 22 May   | bearing_library keeps anon read                     | Free diagnostic looks up specs before login |
| 22 May   | First admin bootstrapped via DISABLE TRIGGER        | Console (postgres) does NOT bypass the guard trigger |

---

## Build Sequence
```
PHASE 1 — Foundation
├── Supabase schema                                   ✓ DONE
├── auth.js shared module                             ✓ DONE
├── Auth + Subscribe modal                            ✓ DONE
├── RAG pipeline (CF Worker + pgvector)               ✓ DONE
├── Animated logo + responsive layout                 ✓ DONE
├── Stripe integration (code)                         ✓ DONE (not live; PayPal deferred)
├── Tier gating — index.html                          ✓ DONE
├── Supabase keep-alive cron                          ✓ DONE (verified)
├── Tier gating — fleet.html                          ✓ DONE (behind flag, off)
├── RLS foundation + admin flag                       ✓ DONE (verified on prod)
├── Admin dashboard (admin.html)                      ← NEXT
└── Landing page                                      ✓ DONE (copy only)

PHASE 1.5 — Stress testing (coverage + accuracy)      ← user priority after admin
├── Anonymous free-flow under RLS (bearing lookup, counter, pluralisation)
├── Fleet flow under RLS (org-scoped reads/writes)
├── Diagnostic accuracy vs CWRU labelled benchmark
├── File-format coverage (CSV/MAT/XLSX/JSON/TSV) + edge cases
└── Robustness (malformed files, odd sample rates, missing metadata)

PHASE 2 — Intelligence (pre-launch)
├── Digital twin Phase 1 (Fleet)
├── Supabase Storage buckets
└── CWRU/NASA feature extraction

PHASE 3 — Growth (post-launch)
├── Confirmed diagnosis feedback loop
├── Email notifications
├── Statistical anomaly detection
├── PayPal integration
└── Fleet Pro tier unlock

PHASE 4 — ML (12-24 months)
├── ML classifier
├── Full digital twin with degradation curve
├── API access for Fleet Pro
└── White-label option
```

---

## Files In This Project
| File                       | Purpose |
|----------------------------|---------|
| CONTEXT.md                 | This file — update after every chat |
| index.html                 | Main diagnostic app |
| app.js                     | Diagnostic engine, Freemium object |
| auth.js                    | Shared auth module — Auth object |
| fleet.html                 | Fleet dashboard (own auth; gating behind FLEET_GATING_ENABLED) |
| landing.html               | Landing page |
| admin.html                 | Admin dashboard — TO BE BUILT |
| agnosticParser2.js         | Agnostic file parser |
| multiChannel.js            | Multi-channel analysis |
| agnosticParser.css         | Parser styles |
| axiomanare-proxy.js        | CF Worker — Claude + embed + RAG + Stripe + cron |
| ISO_10816_Chart_colour.pdf | ISO zone reference |
| Balancing_Report_K394.pdf  | Confirmed imbalance case study |
| rls_foundation_v2.sql      | RLS migration (utility script, run on prod — keep for record) |

---

## How To Use This Project
1. Always read CONTEXT.md first before writing any code.
2. One chat per work stream (naming below).
3. Update CONTEXT.md at end of each chat; re-upload to Project Knowledge;
   commit to repo.

### Chat Naming Convention
"Schema — …", "Auth — …", "Payments — …", "Gating — …", "Landing — …",
"ML — …", "RAG — …", "Twin — …", "Ops — …", "Security — …", "Admin — …",
"UI — …", "Data — KB …", "Stress — …"

### Session Handoff Template
```
Completed this session: [...]
Files changed: [...]
Latest commit: [hash]
Next session should: [...]
```

---

## Session Log — 13 Apr 2026 (Data — KB + ML population)
```
- CWRU .mat dataset downloaded — 109 files, 0 failed
- cwru_label_map.json matches download filenames
- NASA IMS 3rd_test deferred (ZIP corrupt)
- Reports 007–009 anonymised .md (pharma plant, Apr 2023)
Latest commit: 20ca27f
```

## Session Log — 13 Apr 2026 (Schema — profiles + twins + case_library)
```
- Full Supabase schema migration run (NOTE: this was the uncommitted utility
  script — it created profiles, asset_twins, case_library, knowledge_chunks,
  usage_log, subscription_events in prod but was never committed to repo)
- Enums: tier_name, subscription_status, fault_class, iso_zone
- Triggers: handle_new_user, handle_updated_at
- Functions: get_user_tier, get_asset_allowance, increment_analyses_used
- RLS enabled on new tables (but with OPEN policies — see 22 May correction)
- nvr_records: feature_vector, user_confirmed, confirmed_fault, twin_deviation
- Note: organisations flagged UNRESTRICTED (closed 22 May)
Latest commit: 20ca27f
```

## Session Log — 13 Apr 2026 (Auth — modal)
```
- auth.js built (signUp/In/Out, getSession, getTier, getProfile,
  incrementAnalysesUsed, tierAnalysisLimit)
- Auth/Subscribe modal built dynamically inside auth.js
- Nav wired: nav-login-btn, nav-subscribe-btn, nav-user-btn
Latest commit: a0411f4
```

## Session Log — 14 Apr 2026 (RAG — wiring + production test)
```
- CF Worker: POST /embed (Voyage) + POST /rag (Supabase RPC)
- Env vars: VOYAGE_API_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL
- Worker version 1ffa12d1-...
- app.js: ragQuery/buildRagContext/streamClaude with KB injection
- match_knowledge_chunks recreated SECURITY DEFINER
- Production test: /embed /rag /v1/messages all 200
Latest commit: a10b773
```

## Session Log — 15 Apr 2026 (Data — KB CM Summaries)
```
- 8 XLSX CM tables anonymised → MD (CM_SiteA/B/C)
- 40 new chunks embedded; total KB 109
- CMAPSSData.zip assessed, skipped (not relevant)
Latest commit: 1067951
```

## Session Log — 18 Apr 2026 (Data — KB + ML continued)
```
- CWRU YouTube transcript analysed (Amir Resza)
- Implementation validated; CWRU_Dataset_Overview.md committed
Latest commit: 1547bc4
```

## Session Log — 20 Apr 2026 (Data — KB documents)
```
- Scale-Fractal DFA paper EXCLUDED; SKF Install + Handbook INCLUDED;
  VCAT Reference INCLUDED
Latest commit: c95c2e3
```

## Session Log — 21 Apr 2026 (UI — animated logo + responsive)
```
- Animated canvas logo (3 gears + green sine), replaced static SVG
- window load guard fixes animation on GitHub Pages
- Responsive: tablet ≤900, mobile ≤600
Latest commit: 46810ec
```

## Session Log — 21 Apr 2026 (Payments — Stripe integration)
```
- /create-checkout-session + /stripe-webhook routes
- auth.js _doSignup (Supabase → Stripe), _handlePaymentReturn, toast
- PayPal deferred
Latest commit: 286d50d
```

## Session Log — 24 Apr 2026 (Gating — Freemium tier sync)
```
- FREE_ANALYSIS_LIMIT confirmed 5
- Freemium.isPro() reads ax_tier; syncTier() async after auth.js load
- index.html: syncTier() 200ms after auth.js
Latest commit: 76f681a
```

## Session Log — 18 May 2026 (Ops — Supabase keep-alive cron)
```
- Triggered by Supabase 7-day pause warning
- scheduled() handler added to worker; GET /assets?limit=1
- Cron "0 9 */3 * *"; Workers Logs enabled
- Bug: "*/3" inside /** JSDoc */ terminated comment — reworded to prose
Latest commit: 4649bc0
```

## Session Log — 22 May 2026 (Ops — cron verify + Gating — fleet + Security — RLS + admin)
```
Completed this session:
  OPS — keep-alive cron verified:
    - Cloudflare Observability showed "keepalive 200 @ 2026-05-19T09:00:11.867Z",
      0 errors, firing at 09:00 UTC. 18 May handoff item closed.

  GATING — fleet.html tier gating (committed):
    - Confirmed Auth.getTier() returns 'pro'/'fleet_starter'/'fleet_pro'/'free'
      (never null).
    - KEY FINDING: fleet.html uses own auth (raw fetch, _session, ax_session) —
      no supabase-js session. Auth.getTier() would lock out paying fleet users.
    - Added getUserTier() (bearer-token sbGet on profiles), isFleetTier(),
      enforceFleetGate(), #upgrade-screen overlay. Gated both entry points.
    - PARKED behind const FLEET_GATING_ENABLED = false (fleet.html ~line 726).
    - Syntax verified (node --check). Commit 0df5503.

  SECURITY — RLS foundation (rls_foundation_v2.sql, run on prod, success):
    - Discovered schema drift: live DB has 12 tables; profiles + 5 others were
      from the uncommitted 13 Apr migration; fault_detections + zone_progressions
      in schema file but NOT in prod. Stripe columns (stripe_customer_id,
      stripe_sub_id) ALREADY present (pending item was already done).
    - Earlier "RLS hardened" claim was FALSE — open USING(true) beta policies
      live, organisations UNRESTRICTED.
    - Added profiles.is_admin. Helper fns current_org_id()/is_admin()
      (SECURITY DEFINER, search_path set, granted anon+authenticated+service_role).
    - Column-guard trigger on profiles (blocks tier/is_admin/org_id changes;
      exempts service_role + admin).
    - Dropped legacy policies; installed org-scoped + admin policies on all 12
      tables. Migration table-existence-aware (skips missing tables).
    - WIPED test data (Option A): TRUNCATE assets/baselines/nvr_records.
    - Validated in sandbox Postgres 16 (12-table replica) before prod: cross-org
      isolation, escalation block, service_role tier update, admin visibility,
      anon bearing read, anon customer-data lock — all pass. Caught + fixed 2
      GRANT bugs (helpers needed service_role + anon execute) — this is v2.
    - Confirmed on prod: policy counts per table correct, organisations no longer
      UNRESTRICTED, is_admin column present.

  ADMIN bootstrap:
    - handle_new_user trigger CONFIRMED firing (davidlimyk@gmail.com signup
      created a profiles row, tier=free).
    - Bootstrapped first admin: davidlimyk@gmail.com → is_admin=true.
      Required DISABLE TRIGGER (console/postgres does NOT bypass the guard).
    - Note: davidlimyk@gmail.com org_id likely NULL (created via Subscribe path).

  CORRECTIONS LOGGED (see Known Issues):
    - auth.js tierAnalysisLimit() still returns 2 (should be 5)
    - badge pluralisation at count=1 ("1 free analysis")
    - prices HARDCODED $49/$99/$299 in modal vs CONTEXT "TBD"
    - verify free-flow writes to nvr_records/fault_signatures under new RLS

Files changed:
  - fleet.html (committed 0df5503)
  - rls_foundation_v2.sql (utility, run on prod — not committed yet)
  - CONTEXT.md (this rewrite)

Latest code commit: 0df5503

Next session should:
  - Build admin.html (admin v1): gate on is_admin(); subscriber list (email,
    tier, status, analyses_used, signup date); actions = set tier + reset
    analysis count. Reuse index.html CSS vars + Auth object. Config-flag editing
    and analytics are v2.
  - Then stress testing (PHASE 1.5): start with anonymous free-flow under RLS
    and the free-flow nvr_records/fault_signatures write check.
  - Commit rls_foundation_v2.sql + this CONTEXT.md to repo.
```
