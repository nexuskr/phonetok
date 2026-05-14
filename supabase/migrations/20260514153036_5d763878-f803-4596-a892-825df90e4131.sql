-- ═══════════════════════════════════════════════════════════════
-- Hardening Phase 1 / Migration 1
-- live_position_idempotency: lease-based ownership + state machine
-- ═══════════════════════════════════════════════════════════════

-- 1. Status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_idem_status') THEN
    CREATE TYPE public.live_idem_status AS ENUM ('reserved','completed','failed');
  END IF;
END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.live_position_idempotency (
  client_request_id  uuid PRIMARY KEY,
  user_id            uuid NOT NULL,
  params_hash        text NOT NULL,
  status             public.live_idem_status NOT NULL DEFAULT 'reserved',
  lease_owner        uuid NOT NULL,
  lease_until        timestamptz NOT NULL,
  result             jsonb,
  error_code         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_lpi_user_created
  ON public.live_position_idempotency(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lpi_lease_expiry
  ON public.live_position_idempotency(lease_until)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_lpi_terminal_gc
  ON public.live_position_idempotency(created_at)
  WHERE status IN ('completed','failed');

-- 4. RLS
ALTER TABLE public.live_position_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lpi_self_select" ON public.live_position_idempotency;
CREATE POLICY "lpi_self_select"
  ON public.live_position_idempotency
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: no policy = denied for non-SECURITY-DEFINER paths

-- 5. State transition guard trigger
CREATE OR REPLACE FUNCTION public.guard_lpi_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Terminal states are immutable (blocks admin tools, batch jobs, hotfix scripts)
  IF OLD.status IN ('completed','failed') THEN
    RAISE EXCEPTION 'lpi_terminal_state_immutable: % -> % (crid=%)',
      OLD.status, NEW.status, OLD.client_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- From reserved, only reserved (lease renew) or terminal allowed
  IF OLD.status = 'reserved'
     AND NEW.status NOT IN ('reserved','completed','failed') THEN
    RAISE EXCEPTION 'lpi_invalid_transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Immutable identity fields
  IF NEW.client_request_id <> OLD.client_request_id
     OR NEW.user_id <> OLD.user_id
     OR NEW.params_hash <> OLD.params_hash THEN
    RAISE EXCEPTION 'lpi_immutable_fields_changed (crid=%)', OLD.client_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- completed_at must be set when transitioning to terminal
  IF NEW.status IN ('completed','failed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_lpi_transition ON public.live_position_idempotency;
CREATE TRIGGER trg_guard_lpi_transition
  BEFORE UPDATE ON public.live_position_idempotency
  FOR EACH ROW EXECUTE FUNCTION public.guard_lpi_transition();

-- 6. GC function (terminal rows older than 24h)
CREATE OR REPLACE FUNCTION public.gc_live_position_idempotency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH d AS (
    DELETE FROM public.live_position_idempotency
    WHERE status IN ('completed','failed')
      AND created_at < now() - interval '24 hours'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM d;

  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.gc_live_position_idempotency() FROM PUBLIC;

-- 7. Daily GC cron (03:30 KST = 18:30 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('gc-live-position-idempotency')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gc-live-position-idempotency');

    PERFORM cron.schedule(
      'gc-live-position-idempotency',
      '30 18 * * *',
      $cron$ SELECT public.gc_live_position_idempotency(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

COMMENT ON TABLE public.live_position_idempotency IS
  'v3.2 lease-based idempotency for live_open_position. Ownership = UPDATE RETURNING row existence. Terminal states immutable.';