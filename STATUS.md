# LynxEyes — STATUS

> Session handover. Rewrite the short sections at the end of each session.
> How it's built → ARCHITECTURE.md. Test after deploy → DEPLOY_CHECKLIST.md. Why → DECISIONS.md.

**Last updated:** 2026-09-03   **By:** David (Session 10)

---

## Anchors
- **Current HEAD:** `ac779ab` (+ the session-close docs commit that follows it — update after push)
- **Stable tag:** `v1.0-stable` → `4ef5762` (roll back: `git checkout v1.0-stable`)
- **Live:** https://kairosaxiom.github.io/AxiomAnare
- **Scorer version (console banner):** `ba160b1-6`
- **KB:** 201 chunks, 201 embedded. Snapshot table `knowledge_chunks_bak_20260903` exists (drop later).

## Recently confirmed (this session)
- BER-DEBUG logging removed from `app.js` (`ac779ab`); no scoring change; verified live.
- The 9 house-authored KB chunks (5aa2904) are embedded and RETRIEVED live — `bearing_02` was the #1
  `/rag` hit (0.511) on OR_007. Ingest via new `rag_ingest_kb9.py`; embedding via new
  `rag_embed_via_worker.py` (uses the Worker's `/embed`, no local Voyage key needed).
- `.env` is now in `.gitignore` (it was not). Python scripts use the Supabase `sb_secret_` key.
- **Free-flow under RLS is BROKEN, reproduced with evidence:** logged out, analysis renders and AI
  streams, but `app.js:118` POSTs to `nvr_records` (×2) and `assets` return **401** — the save fails
  SILENTLY. Exactly DECISIONS A8. (Open verification #1 from previous sessions is now answered: yes.)
- DECISIONS.md reconciled: original 2 Sep A13 wording restored (reconstructed copy replaced).
- Two-tier output model (A13) is the acceptance bar — the old "CWRU 5/5 confident" target is retired.

## Open verification (small, but do these)
1. **AI report leakage audit:** generate one report (OR_007) and read it for "DECISIONS", "acceptance
   bar", "CWRU", "benchmark", "Governance" — the new `cwru_benchmark_0x` chunks are internal content
   and `/rag` now returns them into the customer prompt. See DECISIONS Part C (3 Sep).
2. **Stripe:** is "Continue to Payment" wired to live Stripe, or still a placeholder?
3. **Fleet:** is `fleet.html` deployed and linked from the app, or built-but-not-wired?

## Next tasks (priority order)
1. **Free-flow / RLS fix** — decide: force sign-in for the free tier, or a deliberately scoped anon
   exception. Never `USING (true)` (A8). Implement, verify incognito: 0 red console errors AND a row
   lands in `nvr_records`. Update DEPLOY_CHECKLIST §5 to match the chosen design.
2. **RAG hygiene bundle** (one small pass, see DECISIONS Part C deferred): exclude
   `category='benchmark'` from `/rag`; strip "Governance:" footers from `bearing_0x` and re-embed;
   backfill `category` on the 121 NULL rows (A9 snapshot first); decide on
   `CWRU_Dataset_Overview.md` (never ingested); then drop `knowledge_chunks_bak_20260903`.
3. Fleet flow under RLS; Stripe secrets/product wiring (Phase 1.5 continues).
4. ISO 20816-3 vs 10816-3 edition question (A1 open item) — citation hygiene, rank above cosmetics.
5. A14 measured-1× anchoring + A15 resolution guard — Phase 1.5 accuracy; CWRU re-run after (A6).
6. Housekeeping: README stale link · Supabase display label → LynxEyes · emoji cleanup (17) ·
   color-literal→`var()` · delete `lynxeye-logo-static.svg` · blue vector logo.

## Notes from last session
- Free tier has NO Supabase backups — manual export / snapshot table before any destructive SQL.
- CWRU acceptance (A13): Normal clean ✓ · IR_007 ✓ · OR_007 ✓ (hedged) · OR_021 ✓ (hedged) ·
  Ball_007 hedge ✓ (BPFI misfires as top fault — known, logged, low priority).
- `rag_ingest.py` has `KB_ROOT` hardcoded to `E:` and a chunker quirk (overlap-only tail chunks on
  500–600-token files). Use `rag_ingest_kb9.py` as the pattern for any new targeted ingest.
- `embed_kb_whitepapers.js` has NO dedup — never re-run it.
- Cloudflare secrets are write-only; there is no known Voyage AI login. `rag_embed_via_worker.py`
  is the working embed path on any machine.
- Office machine (GENESIS-PRJ3) now has tiktoken / voyageai / python-dotenv installed; `.env` lives
  only on disk, untracked.

---

### End-of-session ritual
1. Update HEAD (`git log -1 --format=%h`), Recently confirmed, Open verification, and the date.
2. Re-order Next tasks if priorities changed.
3. `git add STATUS.md && git commit -m "docs: session handover" && git push`
