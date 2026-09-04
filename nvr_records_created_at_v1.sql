-- ══════════════════════════════════════════════════════════════════════════
-- LYNXEYES (repo: AxiomAnare) — nvr_records.created_at TIE-BREAK v1
--
-- Why: recorded_at is the engineer-stated measurement date stored at a fixed
-- 12:00 UTC, so any two readings taken (or uploaded) on the same day carry an
-- identical timestamp. loadAssetHistory ordered by recorded_at only; Postgres
-- returned the tied rows in arbitrary order; the trend regression ran on a
-- shuffled series and reported RGI ("improving") on a machine going
-- 2.75 -> 22.6 mm/s (found 4 Sep 2026, Session 11, test asset ca0aff4f).
--
-- recorded_at stays the truth about SEQUENCE (engineer's date). created_at
-- is upload time and is used ONLY to break same-day ties. No policy changes.
--
-- Idempotent. Run in SQL Editor as postgres. Expect "Success. No rows returned."
-- A9: nvr_records currently holds only test rows; export anyway.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.nvr_records
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows so they are not all equal to the migration instant.
-- Existing rows have no upload-time evidence; use the row's own recorded_at
-- (it is at least in the right day) and let the order be deterministic by id
-- within that day. Session-11 test rows will be re-uploaded anyway.
UPDATE public.nvr_records
   SET created_at = recorded_at
 WHERE created_at >= (now() - interval '1 minute');

CREATE INDEX IF NOT EXISTS nvr_records_asset_time_idx
  ON public.nvr_records (asset_id, recorded_at DESC, created_at DESC);

COMMIT;

-- ── VERIFY (separate tabs) ─────────────────────────────────────────────────
-- Expect: one row, data_type = timestamp with time zone, is_nullable = NO.
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'nvr_records' AND column_name = 'created_at';
-- Expect: the Session-11 test rows, newest first, all with created_at set.
--   SELECT filename, rms_mms, recorded_at, created_at
--   FROM public.nvr_records ORDER BY recorded_at DESC, created_at DESC;
