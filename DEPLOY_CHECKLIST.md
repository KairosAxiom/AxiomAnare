# AxiomAnare — Post-Deploy Test Checklist

> Run EVERY time after `git push`, once GitHub Pages redeploys (~60s) and you've hard-refreshed (Ctrl+Shift+R).
> This is your verification loop. Don't trust "it looks fine."

**Tested by:** ________   **Date:** ________   **Commit:** ________

---

## How deploys work
- **Frontend:** push to `main` → GitHub Pages auto-deploys. No build step.
- **Worker (`restless-tree-eac8`):** edited/deployed in the **Cloudflare dashboard** — NOT git, NOT CLI.
- **Database:** SQL run via Supabase SQL Editor. ⚠️ Free tier = no backups; export before destructive SQL.

## Local pre-push sanity (always)
```bash
node --check app.js     # catches the syntax error that silently kills the whole app
```

---

## 0. Did it even load?
- [ ] Open https://esimconnect.github.io/AxiomAnare — Console shows **zero red errors** on load.
- [ ] Upload drop zone + Analyse button present.

## 1. Single-channel happy path
- [ ] Upload a known-good file (e.g. 97_Normal), set class/RPM/bearing → Analyse.
- [ ] All 6 report sections render; ISO Zone, health index, FFT + radar, trend chart all populate.

## 2. AI report (Worker + RAG)
- [ ] AI section streams in (not "AI summary unavailable"). Blank → check `PROXY_BASE` + Worker live.
- [ ] Report cites only clauses present in the data (no invented references) — DECISIONS A1.

## 3. Multi-channel (up to 6)
- [ ] Channels detected; per-channel radar tab selector works.

## 4. Auth + tiers (after any auth/tier change)
- [ ] Sign up → profile created (if not, the signup trigger isn't firing — see rls_foundation_v2 note).
- [ ] Sign in / sign out; nav UI reflects auth state.
- [ ] Free tier shows 5-analysis allowance; counter behaves.
- [ ] Paid tier (test account) shows unlimited / fleet features unlocked.

## 5. Free-flow / RLS interaction (IMPORTANT — recurring check)
- [ ] **Incognito, logged OUT:** run an analysis. Does it complete and save?
- [ ] If a Supabase permission error appears on nvr_records → logged-out save is blocked by org-scoped RLS.
      The free flow must run authenticated, or needs a scoped anon exception. (DECISIONS A8.)

## 6. Fleet dashboard (after any fleet change)
- [ ] `fleet.html` loads for a fleet-tier account; shows only THAT org's assets (not others').
- [ ] Asset table search/filter and asset detail panel work.

## 7. CWRU benchmark (after ANY diagnostic/FFT/scoring change)
- [ ] 97_Normal ✓ · 105_IR ✓ · 118_Ball (gap) · 130_OR ✓ · 234_OR ✓
- [ ] **Score unchanged or improved. If it dropped, the change regressed the engine — revert.**

---

## If anything fails
1. Note the step. Don't patch live in a panic.
2. `git checkout v1.0-stable` restores last known-good frontend.
3. Reproduce, fix, re-run THIS checklist before pushing again.
