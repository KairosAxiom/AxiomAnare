# AxiomAnare — STATUS

> Session handover. Rewrite the short sections at the end of each session.
> How it's built → ARCHITECTURE.md. Test after deploy → DEPLOY_CHECKLIST.md. Why → DECISIONS.md.

**Last updated:** 2026-05-23   **By:** David

---

## Anchors
- **Current HEAD:** `82ce298`
- **Stable tag:** `v1.0-stable` → `4ef5762` (roll back: `git checkout v1.0-stable`)
- **Live:** https://esimconnect.github.io/AxiomAnare

## Recently confirmed (this session)
- RLS v2 migration is APPLIED — DB is org-scoped and locked down. SaaS schema is live.
- Vib-derived electrical cap = 19 (intentional, below Indicative). Keep it.
- Worker `restless-tree-eac8` is dashboard-managed; no local deploy command.
- Fleet dashboard (`fleet.html`) and auth/tier layer (`auth.js`) are BUILT.

## Open verification (small, but do these)
1. **Free-flow check:** in incognito (logged out), run an analysis — does it error or fail to save to
   nvr_records? Org-scoped RLS will reject logged-out writes. If the free flow has a logged-out path,
   it's broken and needs either forced sign-in or a scoped anon exception. (See DECISIONS A8.)
2. **Stripe:** is "Continue to Payment" actually wired to live Stripe, or still a placeholder?
3. **Fleet:** is `fleet.html` deployed and linked from the app, or built-but-not-wired?

## Next tasks (priority order)
1. Resolve the free-flow / RLS interaction (verification #1 above) — could be silently broken now
2. 118_Ball fix → CWRU 5/5 (engine not fully validated until then)
3. Verify ISO clause references in CONFIG against `KB/Standards` (esp. the `S5.x` notation) — DECISIONS A1
4. Fix the stale live URL in `README.md`
5. Multi-channel radar per-channel tab selector
6. Confirm Stripe + fleet deployment status (verification #2, #3)

## Notes from last session
- Free tier has NO Supabase backups — manual export before any destructive SQL.
- CWRU currently 4/5 (118_Ball is the miss).
- [ADD anything a fresh session would need]

---

### End-of-session ritual
1. Update HEAD (`git log -1 --format=%h`), Recently confirmed, Open verification, and the date.
2. Re-order Next tasks if priorities changed.
3. `git add STATUS.md && git commit -m "docs: session handover" && git push`
