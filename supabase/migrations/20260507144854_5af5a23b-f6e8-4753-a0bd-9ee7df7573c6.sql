
-- Enums
DO $$ BEGIN
  CREATE TYPE public.ai_bot_kind AS ENUM ('content','trading','image');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_bot_status AS ENUM ('running','ready','claimed','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.ai_bot_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind public.ai_bot_kind NOT NULL,
  status public.ai_bot_status NOT NULL DEFAULT 'running',
  prompt TEXT,
  output_text TEXT,
  output_path TEXT,
  reward BIGINT NOT NULL DEFAULT 0,
  trading_seed NUMERIC,
  trading_pnl_pct NUMERIC,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abr_user_kind_day ON public.ai_bot_runs(user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abr_status ON public.ai_bot_runs(status);

ALTER TABLE public.ai_bot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS abr_self_select ON public.ai_bot_runs;
CREATE POLICY abr_self_select ON public.ai_bot_runs
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_bot_runs;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-outputs','ai-outputs', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ai_outputs_self_read" ON storage.objects;
CREATE POLICY "ai_outputs_self_read" ON storage.objects
  FOR SELECT USING (
    bucket_id='ai-outputs' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'admin')
    )
  );

-- Tier daily limits per bot kind (returns int)
CREATE OR REPLACE FUNCTION public.ai_bot_daily_limit(_tier user_tier, _kind ai_bot_kind)
RETURNS INT
LANGUAGE sql IMMUTABLE SET search_path=public
AS $$
  SELECT CASE _kind
    WHEN 'content' THEN CASE _tier WHEN 'normal' THEN 1 WHEN 'vip' THEN 3 WHEN 'god' THEN 10 WHEN 'empire' THEN 30 END
    WHEN 'trading' THEN CASE _tier WHEN 'normal' THEN 1 WHEN 'vip' THEN 2 WHEN 'god' THEN 5  WHEN 'empire' THEN 10 END
    WHEN 'image'   THEN CASE _tier WHEN 'normal' THEN 1 WHEN 'vip' THEN 2 WHEN 'god' THEN 5  WHEN 'empire' THEN 10 END
  END
$$;

-- Base reward (KRW) per kind
CREATE OR REPLACE FUNCTION public.ai_bot_base_reward(_kind ai_bot_kind)
RETURNS BIGINT
LANGUAGE sql IMMUTABLE SET search_path=public
AS $$
  SELECT CASE _kind
    WHEN 'content' THEN 3000
    WHEN 'trading' THEN 8000
    WHEN 'image'   THEN 5000
  END::bigint
$$;

-- START: enforces daily limit, creates row in 'running'
CREATE OR REPLACE FUNCTION public.start_ai_bot_run(_kind ai_bot_kind, _prompt TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _tier public.user_tier;
  _limit INT;
  _used INT;
  _id UUID;
  _exp TIMESTAMPTZ;
  _seed NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF length(coalesce(_prompt,'')) > 1000 THEN RAISE EXCEPTION 'prompt_too_long'; END IF;

  SELECT tier INTO _tier FROM public.profiles WHERE id=_uid;
  IF _tier IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;

  _limit := public.ai_bot_daily_limit(_tier, _kind);

  SELECT COUNT(*) INTO _used FROM public.ai_bot_runs
   WHERE user_id=_uid AND kind=_kind
     AND created_at::date = CURRENT_DATE
     AND status <> 'failed';

  IF _used >= _limit THEN
    RAISE EXCEPTION 'daily_limit:%', _limit;
  END IF;

  IF _kind = 'trading' THEN
    _exp := now() + interval '8 hours';
    _seed := random();
  END IF;

  INSERT INTO public.ai_bot_runs(user_id, kind, status, prompt, expires_at, trading_seed)
    VALUES (_uid, _kind,
            CASE WHEN _kind='trading' THEN 'running' ELSE 'running' END,
            _prompt, _exp, _seed)
    RETURNING id INTO _id;

  RETURN jsonb_build_object('ok',true,'id',_id,'used',_used+1,'limit',_limit,'expires_at',_exp);
END $$;

REVOKE EXECUTE ON FUNCTION public.start_ai_bot_run(ai_bot_kind, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ai_bot_run(ai_bot_kind, TEXT) TO authenticated;

-- FINALIZE: only service_role (called by edge function after AI call)
CREATE OR REPLACE FUNCTION public.finalize_ai_bot_run(
  _run_id UUID, _output_text TEXT, _output_path TEXT, _error TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE _row public.ai_bot_runs%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.ai_bot_runs WHERE id=_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status NOT IN ('running') THEN RAISE EXCEPTION 'invalid_state'; END IF;

  IF _error IS NOT NULL THEN
    UPDATE public.ai_bot_runs SET status='failed', error=_error WHERE id=_run_id;
    RETURN jsonb_build_object('ok',false,'error',_error);
  END IF;

  -- For trading bot: NOT ready yet (must wait expires_at). Just store nothing.
  IF _row.kind = 'trading' THEN
    -- Trading text/image filled at claim time
    UPDATE public.ai_bot_runs SET output_text=_output_text WHERE id=_run_id;
  ELSE
    UPDATE public.ai_bot_runs
       SET status='ready', output_text=_output_text, output_path=_output_path, ready_at=now()
     WHERE id=_run_id;
  END IF;

  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE EXECUTE ON FUNCTION public.finalize_ai_bot_run(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- CLAIM: credits wallet (and computes trading PnL deterministically)
CREATE OR REPLACE FUNCTION public.claim_ai_bot_run(_run_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.ai_bot_runs%ROWTYPE;
  _tier public.user_tier;
  _boost NUMERIC;
  _base BIGINT;
  _final BIGINT;
  _pnl NUMERIC;
  _wallet public.wallet_balances%ROWTYPE;
  _today DATE := CURRENT_DATE;
  _month TEXT := to_char(CURRENT_DATE,'YYYY-MM');
  _cap BIGINT; _cap_left BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO _row FROM public.ai_bot_runs WHERE id=_run_id FOR UPDATE;
  IF NOT FOUND OR _row.user_id <> _uid THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status = 'claimed' THEN RAISE EXCEPTION 'already_claimed'; END IF;

  -- Trading: must be past expires_at
  IF _row.kind='trading' THEN
    IF _row.expires_at IS NULL OR now() < _row.expires_at THEN
      RAISE EXCEPTION 'not_ready';
    END IF;
    -- Compute deterministic PnL: -8% .. +25% range, weighted by tier
    SELECT tier INTO _tier FROM public.profiles WHERE id=_uid;
    _pnl := round(((coalesce(_row.trading_seed,0.5) - 0.30) * 33.0)::numeric, 2);
    -- empire bonus +5%, god +2%
    IF _tier='empire' THEN _pnl := _pnl + 5; END IF;
    IF _tier='god'    THEN _pnl := _pnl + 2; END IF;
    _row.trading_pnl_pct := _pnl;
  ELSE
    IF _row.status <> 'ready' THEN RAISE EXCEPTION 'not_ready'; END IF;
  END IF;

  SELECT tier INTO _tier FROM public.profiles WHERE id=_uid;
  _boost := public.tier_boost(_tier);
  _base  := public.ai_bot_base_reward(_row.kind);

  IF _row.kind='trading' THEN
    -- Reward scales with PnL%: base * (1 + pnl/100), floor 0
    _final := GREATEST(0, FLOOR(_base * GREATEST(0, 1 + _pnl/100.0) * _boost))::bigint;
  ELSE
    _final := FLOOR(_base * _boost)::bigint;
  END IF;

  -- Wallet update with daily cap
  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_uid FOR UPDATE;
  IF _wallet.last_reset_date <> _today THEN
    _wallet.today_earned := 0; _wallet.last_reset_date := _today;
  END IF;
  IF _wallet.last_reset_month <> _month THEN
    _wallet.monthly_earned := 0; _wallet.last_reset_month := _month;
  END IF;
  _cap := public.tier_daily_cap(_tier);
  _cap_left := GREATEST(0, _cap - _wallet.today_earned);
  IF _final > _cap_left THEN _final := _cap_left; END IF;

  IF _final > 0 THEN
    UPDATE public.wallet_balances SET
      available_balance = available_balance + _final,
      total_balance = total_balance + _final,
      today_earned = _wallet.today_earned + _final,
      monthly_earned = _wallet.monthly_earned + _final,
      last_reset_date = _today, last_reset_month = _month,
      updated_at = now()
    WHERE user_id=_uid;
  END IF;

  UPDATE public.ai_bot_runs
     SET status='claimed', claimed_at=now(), reward=_final,
         trading_pnl_pct=_row.trading_pnl_pct
   WHERE id=_run_id;

  IF _final > 0 THEN
    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
      VALUES (_uid, 'mission_win', 'credit', _final,
              _wallet.total_balance + _final, _wallet.available_balance + _final,
              _run_id::text,
              jsonb_build_object('source','ai_bot','bot_kind',_row.kind,'tier',_tier,'pnl_pct',_row.trading_pnl_pct));
  END IF;

  RETURN jsonb_build_object('ok',true,'reward',_final,'pnl_pct',_row.trading_pnl_pct);
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_ai_bot_run(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_bot_run(UUID) TO authenticated;
