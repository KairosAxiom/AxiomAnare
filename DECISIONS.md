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
