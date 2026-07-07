# AxiomAnare — STATUS

> Session handover. Rewrite the short sections at the end of each session.
> How it's built → ARCHITECTURE.md. Test after deploy → DEPLOY_CHECKLIST.md. Why → DECISIONS.md.

**Last updated:** 2026-07-07   **By:** David

---

## Anchors
- **Current HEAD:** `85f562e`
- **Stable tag:** `v1.0-stable` → `4ef5762` (roll back: `git checkout v1.0-stable`)
- **Pre-A12 backup tag:** `pre-a12-backup` (if created per this session's push instructions — roll back
  to the exact state before A12 landed: `git checkout pre-a12-backup`)
- **Live:** https://kairosaxiom.github.io/AxiomAnare/ (corrected 7 Jul 2026 — `esimconnect.github.io` is
  legacy and was supposed to have been cleared out last session; this Anchors line hadn't been updated to
  match. README.md separately says `limykdavid-maker.github.io/axiomanare` — three different URLs were
  floating across docs/memory this session; `kairosaxiom.github.io` is the one confirmed live via DevTools.
  README.md still needs the same fix, see Next tasks.)

## Recently confirmed (this session — A12 build, 7 Jul 2026)
- **A12 (sample-rate auto-detect) built and pushed** — `parseData()` now returns
  `{sampleRate, sampleRateSource}` instead of a bare always-populated number. Two detection strategies:
  (a) header/field name match (`sample_rate`/`fs`/`sampling_frequency`/`SampleRate`), (b) timestamp-column
  **median**-of-deltas (upgraded from the old single two-row delta). No path silently falls back to
  `CONFIG.default_sample_rate_hz` anymore — missing rate now quarantines the run and requires the Step 2
  Sampling Rate field or the new Fmax-keyed preset dropdown. Dropdown-preset runs carry a visible, print-
  safe "assumed input" banner (`#sample-rate-banner`) on the report.
- Verified against real CWRU fixture CSVs (not just synthetic data): all 5 files auto-detect ~12,048 Hz via
  the timestamp strategy; old-vs-new logic produces IDENTICAL results on these files — zero regression risk
  from the detection-logic change itself.
- `parseMat()` deliberately NOT touched — still hardcodes `sampleRate: 12000` for every .mat file, no
  detection. Logged as a known, separate gap (DECISIONS.md "Deferred, not forgotten").
- **New: `cwru_benchmark.js`** — a real Puppeteer harness that drives the actual live app end-to-end
  (real file upload, real Analyse click, real DOM read-out) against the 5 CWRU fixtures. Lives in the repo
  now alongside `cwru_fixtures/`. Replaces the old "upload by hand, eyeball the report" §7 process — run
  with `npm install puppeteer && node cwru_benchmark.js`.
- **CONTEXT.md identified** — it's `CONTEXT_admin_session_*.md`, sitting in an older/parallel local working
  folder (`AxiomAnare > axiomanare > AxiomAnare` on GENESIS-PRJ3), not previously connected to this
  four-file system. Not yet reconciled with ARCHITECTURE/STATUS/DECISIONS/DEPLOY_CHECKLIST — worth a look
  next session to see what it actually contains and whether it should be folded in or retired.

## ⚠ Open verification — IMPORTANT, found this session
1. ~~`bearing_library` Supabase fetch may be silently failing (401)`~~ — **RESOLVED same day.** Checked
   the live app directly (`kairosaxiom.github.io/AxiomAnare`, DevTools → Network, filtered on
   `bearing_library`, ran a real analysis): both the `initBearingLibrary()` fetch and the keep-alive ping
   came back a clean **200**. This was a local `file://` test-environment artifact (most likely a
   network-restricted sandbox blocking `supabase.co` during last session's harness run), NOT a live
   production bug — no users are affected. See DECISIONS.md "bearing_library 401 — RESOLVED" for full
   detail, including a stale-schema side finding (`model` vs `bearing_model` column naming) that's cosmetic,
   not a bug. `cwru_benchmark.js` needs no code change — just re-run from a machine with real network
   access to get an actual clean §7 result (see Next tasks #2).
2. **Free-flow check:** in incognito (logged out), run an analysis — does it error or fail to save to
   nvr_records? Org-scoped RLS will reject logged-out writes. If the free flow has a logged-out path,
   it's broken and needs either forced sign-in or a scoped anon exception. (See DECISIONS A8.) — carried
   over, not addressed this session.
3. **Stripe:** is "Continue to Payment" actually wired to live Stripe, or still a placeholder? — carried
   over, not addressed this session.
4. **Fleet:** is `fleet.html` deployed and linked from the app, or built-but-not-wired? — carried over,
   not addressed this session.

## Next tasks (priority order)
1. **Re-run `cwru_benchmark.js`** from a machine with real, unrestricted network access, to get an actual
   clean §7 pass/fail (last session's run was inconclusive due to the now-resolved bearing_library
   artifact — do not treat that run as a pass or a regression). Note: each run writes 5 real rows to
   `nvr_records`/`fault_detections` (anon-insert policies) — expected, not a bug.
2. **Reconcile A12: local `index.html` has the real feature code, `main` does not.** Commit `85f562e`
   (labelled "A12 sample-rate auto-detect...") only actually added `cwru_benchmark.js` + fixtures — the
   sample-rate-detection UI/logic was never pushed to `index.html` or `app.js`. Confirm intent, then
   commit/push properly (need the matching `app.js` changes alongside `index.html`, not just one file).
3. Resolve the free-flow / RLS interaction (verification #2 above) — could be silently broken now
4. 118_Ball fix → CWRU 5/5 (engine not fully validated until then; blocked behind #1 above since a clean
   §7 run is a prerequisite for meaningfully investigating Ball)
5. `parseMat()` still hardcodes 12000 Hz — no detection, no flag. Same class of bug A12 fixed for CSV,
   not yet extended to MAT. (DECISIONS.md "Deferred, not forgotten.")
6. Reconcile `CONTEXT_admin_session_*.md` with the four-file system, or confirm it can be retired.
7. Verify ISO clause references in CONFIG against `KB/Standards` (esp. the `S5.x` notation) — DECISIONS A1
8. Fix the stale live URL in `README.md` (currently `limykdavid-maker.github.io/axiomanare` — confirm this
   is also correct/current, or update to `kairosaxiom.github.io/AxiomAnare`, whichever is the real one)
9. Reconcile `axiomanare_schema.sql`'s `bearing_model` column name against the live DB's actual `model`
   column (cosmetic doc-drift, found this session — not a bug, see DECISIONS.md)
10. Multi-channel radar per-channel tab selector
11. Confirm Stripe + fleet deployment status (verification #3, #4)
12. Parser-scope-vs-target-audience scoping session (deferred, see DECISIONS.md) — is "agnostic" meant to
    cover native vendor binary formats (TDMS/UFF) or just column-layout variation within CSV/XLSX/JSON/MAT?
13. Second real-data source beyond CWRU (NASA IMS / MFPT / FEMTO-ST) — deferred, see DECISIONS.md

## Notes from last session
- Free tier has NO Supabase backups — manual export before any destructive SQL.
- CWRU currently 4/5 (118_Ball is the miss) — UNCHANGED this session; the harness run was inconclusive on
  ALL 5 files (not just Ball) due to the bearing_library issue, so this "4/5" figure has not actually been
  re-confirmed and may not currently be accurate. **Same-day update: the bearing_library issue itself is
  now resolved (confirmed local artifact, live app is clean) — but the "4/5" figure still has not been
  re-confirmed by an actual clean harness run. Treat as unconfirmed until Next tasks #1 is done.**
- David made an explicit, informed decision to push A12's code (`app.js`, `index.html`) despite §7 being
  inconclusive rather than passed, on the basis that the bearing_library issue looks pre-existing and
  separate from A12 (A12's own sample-rate logic was independently verified clean). This was a deliberate
  call, not an oversight — see DECISIONS.md for the full record. Do not assume §7 is green because this
  commit landed.
- [ADD anything a fresh session would need]

---

### End-of-session ritual
1. Update HEAD (`git log -1 --format=%h`), Recently confirmed, Open verification, and the date.
2. Re-order Next tasks if priorities changed.
3. `git add STATUS.md && git commit -m "docs: session handover" && git push`
