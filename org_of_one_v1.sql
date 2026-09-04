-- ══════════════════════════════════════════════════════════════════════════
-- LYNXEYES (repo: AxiomAnare) — ORG-OF-ONE MIGRATION v1
-- Makes the tenancy model in DECISIONS A8 actually true for accounts created
-- through index.html: "an individual = an org of one".
--
-- Why: rls_foundation_v2 scoped assets/baselines/nvr_records to
-- profiles.org_id, but handle_new_user never created an organisation, so
-- every index.html signup has org_id = NULL and every customer-silo INSERT is
-- refused with 42501 — even when signed in. The client never sent org_id
-- either. Trend history silently stopped being written on 22 May 2026.
--
-- What this does (idempotent, safe to re-run):
--   1. Backfill: create an organisation-of-one for every profile with NULL org_id.
--   2. profiles BEFORE INSERT trigger: auto-create an org-of-one when a new
--      profile arrives without org_id (fires after handle_new_user inserts).
--   3. Relax the column-guard: a user may move between orgs they OWN
--      (fleet.html register creates an org then assigns it). Joining someone
--      else's org, and all tier / is_admin changes, stay blocked.
--   4. assets / nvr_records BEFORE INSERT triggers: fill org_id from
--      current_org_id() (assets) or the parent asset (nvr_records) when the
--      client omits it. BEFORE triggers run before RLS WITH CHECK, so the
--      existing v2 policies pass unchanged. No policy is touched (A8).
--
-- A9: take a manual export of organisations + profiles before running.
-- Run in Supabase SQL Editor as postgres. Expect "Success. No rows returned."
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Precondition ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='organisations' AND column_name='owner_id') THEN
    RAISE EXCEPTION 'organisations.owner_id missing — schema drift, stop and check';
  END IF;
END $$;

-- ── 1. Helper: create an org-of-one for a user ─────────────────────────────
CREATE OR REPLACE FUNCTION public.create_org_of_one(p_user_id uuid, p_label text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
DECLARE
  v_org uuid;
BEGIN
  INSERT INTO public.organisations (name, owner_id)
  VALUES (COALESCE(p_label, 'Individual ' || left(p_user_id::text, 8)), p_user_id)
  RETURNING id INTO v_org;
  RETURN v_org;
END;
$fn$;
REVOKE ALL ON FUNCTION public.create_org_of_one(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_org_of_one(uuid, text) TO service_role;

-- ── 2. profiles BEFORE INSERT: org-of-one when none supplied ───────────────
CREATE OR REPLACE FUNCTION public.ensure_profile_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.create_org_of_one(NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_ensure_profile_org ON public.profiles;
CREATE TRIGGER trg_ensure_profile_org
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_org();

-- ── 3. Column guard: allow a FIRST org claim, owner-verified only ───────────
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.tier     IS DISTINCT FROM OLD.tier     THEN
    RAISE EXCEPTION 'tier may only be changed by an administrator or billing system';
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'is_admin may only be changed by an administrator';
  END IF;
  IF NEW.org_id   IS DISTINCT FROM OLD.org_id   THEN
    -- Bounded relaxation (org-of-one v1): a user may move to an org they
    -- OWN, provided they also own (or have no) current org. This is what the
    -- fleet.html register path needs once every profile starts with an
    -- auto-created org-of-one. Joining an org owned by someone else stays
    -- blocked — that path must go through an admin.
    IF NEW.org_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.organisations o
                   WHERE o.id = NEW.org_id AND o.owner_id = auth.uid())
       AND (OLD.org_id IS NULL OR EXISTS (SELECT 1 FROM public.organisations o
                                          WHERE o.id = OLD.org_id AND o.owner_id = auth.uid())) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'org_id may only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$fn$;
-- (trigger trg_guard_profile_privileged_cols already bound to this function by v2)

-- ── 4. assets BEFORE INSERT: fill org_id from the caller's org ─────────────
CREATE OR REPLACE FUNCTION public.assets_fill_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_assets_fill_org_id ON public.assets;
CREATE TRIGGER trg_assets_fill_org_id
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.assets_fill_org_id();

-- ── 5. nvr_records BEFORE INSERT: inherit org_id from parent asset ─────────
-- (v2 policy scopes nvr_records via asset_id, not nvr_records.org_id — this
--  keeps the denormalised column consistent for Fleet queries, nothing more.)
CREATE OR REPLACE FUNCTION public.nvr_records_fill_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
BEGIN
  IF NEW.org_id IS NULL AND NEW.asset_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.assets WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_nvr_records_fill_org_id ON public.nvr_records;
CREATE TRIGGER trg_nvr_records_fill_org_id
  BEFORE INSERT ON public.nvr_records
  FOR EACH ROW EXECUTE FUNCTION public.nvr_records_fill_org_id();

-- ── 6. Backfill existing org-less profiles (incl. davidlimyk@gmail.com) ────
-- Runs as postgres: the column guard fires on UPDATE, but postgres is not
-- exempt (learned 22 May). Disable the guard for this statement only.
ALTER TABLE public.profiles DISABLE TRIGGER trg_guard_profile_privileged_cols;
UPDATE public.profiles p
   SET org_id = public.create_org_of_one(p.id, NULL)
 WHERE p.org_id IS NULL;
ALTER TABLE public.profiles ENABLE TRIGGER trg_guard_profile_privileged_cols;

COMMIT;

-- ── 7. VERIFY (run separately, paste results back) ─────────────────────────
-- Expect: zero rows.
--   SELECT id FROM public.profiles WHERE org_id IS NULL;
-- Expect: one row per profile, owner_id = profile id.
--   SELECT p.id, p.org_id, o.owner_id = p.id AS owner_ok, o.name
--   FROM public.profiles p JOIN public.organisations o ON o.id = p.org_id;
-- Expect: 4 triggers listed.
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE tgname IN ('trg_ensure_profile_org','trg_assets_fill_org_id',
--                    'trg_nvr_records_fill_org_id','trg_guard_profile_privileged_cols');
