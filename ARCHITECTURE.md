# AxiomAnare — Architecture

> Source of truth for how this project is built. Update when the project changes.
> Companion files: STATUS.md (where we are), DEPLOY_CHECKLIST.md (after every push), DECISIONS.md (why + guardrails).

**Company:** Kairos Ventures Pte Ltd
**Product:** Vibration diagnostic engine + multi-tenant SaaS (auth, tiers, fleet dashboard)
**Live:** https://esimconnect.github.io/AxiomAnare
**Repo:** https://github.com/esimconnect/AxiomAnare (org: esimconnect)
**Stable anchor:** tag `v1.0-stable` → commit `4ef5762`

> ⚠️ `README.md` shows a stale/wrong live URL (`limykdavid-maker.github.io/axiomanare`). Fix it.

---

## 1. What it does
An engineer uploads a vibration data file (CSV/TSV/XLSX/XLS/JSON/TXT/MAT), selects machine class,
enters nameplate RPM and bearing model. The engine detects shaft frequency and runs a 6-stage pipeline,
returning fault indicators, health index, FFT + radar charts, trend chart, and an AI-written report —
all referenced to ISO/IEC standards. Around this core sits an auth + subscription layer and an
org-scoped fleet dashboard for multi-asset customers.

## 2. The diagnostic pipeline
```
Ingest → Baseline Comparison → Trend Assessment → ISO Zone → Fault Classification → RUL
```
Shaft frequency via harmonic comb search; faults classified from the FFT using per-bearing frequency
multipliers (BPFO/BPFI/BSF/FTF) plus envelope/BER analysis.

## 3. Tech stack
| Layer | Technology | Notes |
|---|---|---|
| Frontend | Pure HTML + JS | no build step, no framework — edit `index.html` / `app.js` / `fleet.html` directly |
| Auth + tiers | `auth.js` + Supabase Auth | shared module loaded by index.html and fleet.html |
| Parsing | PapaParse + SheetJS | CSV/TSV/JSON + Excel |
| Charts | Chart.js | FFT + radar + trend |
| Hosting | GitHub Pages | auto-deploys on push to `main` |
| Database | Supabase | ref `zjfhxutcvjxootoekade`, region ap-southeast-1 (Singapore), Free tier |
| AI / proxy | Cloudflare Worker `restless-tree-eac8` | **dashboard-managed — no local CLI deploy** |
| Payments | Stripe | "Continue to Payment" on signup — [verify live status] |
| AI model | `claude-sonnet-4-20250514` | max_output_tokens 1000 |

**Working dir (drive varies by machine):** home ThinkPad (DadThinkPadE495) `/e/Kairos/AxiomAnare/axiomanare/AxiomAnare`;
office (GENESIS-PRJ3) `/d/Kairos/...`.

## 4. Pages / components
- `index.html` + `app.js` — the diagnostic engine (single + multi-channel up to 6).
- `auth.js` — sign up / in / out, session, profile + tier lookup, analysis-count increment, auth modal UI.
- `fleet.html` — **BUILT** org-scoped fleet dashboard: asset table, search/filter, batch asset entry,
  asset detail panel, fleet stats. [Verify it's deployed and linked from the app.]
- `admin.html` — admin view.

## 5. The CONFIG layer (design principle)
All thresholds, machine classes, ISO zone tables, fault rules, and **ISO clause references** live as DATA
in a CONFIG object at the top of `app.js` — not hardcoded in logic. This makes the anti-hallucination
rules enforceable (see DECISIONS A1) and lets standards be corrected in one place.
Key values: `minimum_fault_confidence_pct: 8`; "Indicative" tier at score ≥ 20; vib-derived electrical
cap = **19** (deliberately below Indicative — DECISIONS A4); mechanical cap = 10 when bearing BER exceeds threshold.

## 6. Subscription tiers (in auth.js)
| Tier | Price | Allowance |
|---|---|---|
| Free | — | 5 analyses (must match `FREE_ANALYSIS_LIMIT` in app.js) |
| Pro | $49/mo | unlimited analyses, full AI report |
| Fleet Starter | $99/mo | up to 10 assets, fleet dashboard |
| Fleet Pro | $299/mo | up to 30 assets, priority support |
Tier lives on `profiles.tier`. Free-tier gating is enforced server-side via the profile, not just the
client-side counter.

## 7. Cloudflare Worker (`restless-tree-eac8.kairosventure-io.workers.dev`)
Proxy so the Anthropic key stays server-side. **Edited/deployed via the Cloudflare dashboard — no
`wrangler.toml`, no CLI deploy.**
| Route | Purpose |
|---|---|
| `/v1/messages` | Anthropic proxy (streaming) — the AI report |
| `/embed` | Voyage AI embeddings (RAG) |
| `/rag` | Supabase vector search (`match_knowledge_chunks`) |
Secrets (dashboard only): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`, `VOYAGE_API_KEY`.

## 8. Supabase — multi-tenant, RLS CLOSED
**Architecture:** every `profiles` row has an `org_id`; an individual is an "org of one"; an admin
(`profiles.is_admin`) sees everything. Customer data is org-scoped.

**RLS status: CLOSED and org-scoped — `rls_foundation_v2.sql` has been APPLIED** (confirmed by live
policy names: `assets_all_org_or_admin`, `nvr_records_all_org_or_admin`, `profiles_select_own_or_admin`,
`organisations_*`, etc.). The old open "Public insert/read" beta policies are gone.
- `bearing_library` keeps anon SELECT (the free diagnostic needs it).
- Helper fns `current_org_id()` and `is_admin()` (SECURITY DEFINER) break RLS recursion.
- A trigger blocks non-admins from changing their own `tier` / `is_admin` / `org_id`.
- Note: in the Policies UI, "APPLIED TO: public" = the Postgres `public` role, NOT public access; the
  USING clauses do the restricting.

**Tables — customer silo:** organisations, assets, baselines, nvr_records, fault_detections, profiles.
**Cumulative silo (anonymised):** fault_signatures, zone_progressions.
**Shared reference:** bearing_library (32 bearings seeded).
**Built for future features (admin-only RLS):** asset_twins, case_library, knowledge_chunks, usage_log, subscription_events.

⚠️ **Free tier = NO automatic backups.** Take a manual export before any destructive SQL.

## 9. Validation — CWRU benchmark (ground truth)
97_Normal ✓ · 105_IR ✓ · 118_Ball ✗ (known gap) · 130_OR ✓ · 234_OR ✓ → **4/5**. Not fully validated until 5/5.

## 10. Standards in scope (the ringfence)
ISO 10816-3, ISO 13373-1 & 13373-2, ISO 13379-1, ISO 13381-1, IEC 60034-14, ISO 55001 (per README).
> ⚠️ Clause references are CONFIG constants. The `§x.x` style looks conventional; the `Table 1 S5.1` /
> `S5.2` style does NOT match ISO/IEC numbering — verify against `KB/Standards`. See DECISIONS A1.

## 11. "If it breaks" playbook
1. AI report blank → Worker problem; check `PROXY_BASE` in `app.js` and that the Worker is live.
2. Whole app dead after a change → `node --check app.js` for a syntax error.
3. Roll back → `git checkout v1.0-stable`.
4. Wrong classification → re-run the CWRU benchmark.
5. Logged-out analysis fails to save → expected under org-scoped RLS; the free flow must run authenticated
   (or needs a scoped anon exception). See DECISIONS A8.
6. Worker change → edit in the Cloudflare dashboard (no CLI).
