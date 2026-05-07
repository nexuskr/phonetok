
-- =========================================================
-- PHASE 12: deposit_requests
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deposit_method AS ENUM ('bank','coin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  method public.deposit_method NOT NULL DEFAULT 'bank',
  package_id TEXT,
  package_name TEXT,
  receipt_url TEXT,
  memo TEXT,
  status public.deposit_status NOT NULL DEFAULT 'pending',
  rejected_reason TEXT,
  admin_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY dr_self_select ON public.deposit_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY dr_self_insert ON public.deposit_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY dr_admin_update ON public.deposit_requests FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_dr_user ON public.deposit_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_status ON public.deposit_requests(status);

-- transactions enum may not include 'deposit_credit'; we will reuse 'mission_win' for credit logging if needed
-- Try add deposit kind safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='transaction_kind') THEN
    BEGIN
      ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'deposit_credit';
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'admin_adjust';
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'package_settle';
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- =========================================================
-- PHASE 15: jackpot_pool + leaderboard view
-- =========================================================
CREATE TABLE IF NOT EXISTS public.jackpot_pool (
  id INT PRIMARY KEY DEFAULT 1,
  amount BIGINT NOT NULL DEFAULT 12500000,
  last_winner UUID,
  last_winner_nickname TEXT,
  last_won_amount BIGINT,
  last_won_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jackpot_pool_singleton CHECK (id = 1)
);
INSERT INTO public.jackpot_pool(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.jackpot_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY jp_public_read ON public.jackpot_pool FOR SELECT USING (true);

CREATE OR REPLACE VIEW public.leaderboard_today
WITH (security_invoker = on) AS
SELECT
  ds.user_id,
  COALESCE(p.nickname, '익명') AS nickname,
  p.tier,
  ds.earned,
  ds.wins,
  ds.best_streak,
  RANK() OVER (ORDER BY ds.earned DESC) AS rank
FROM public.daily_stats ds
LEFT JOIN public.profiles p ON p.id = ds.user_id
WHERE ds.stat_date = CURRENT_DATE AND ds.earned > 0
ORDER BY ds.earned DESC
LIMIT 100;

GRANT SELECT ON public.leaderboard_today TO anon, authenticated;

-- =========================================================
-- PHASE 12: submit_deposit / admin_resolve_deposit
-- =========================================================
CREATE OR REPLACE FUNCTION public.submit_deposit(
  _amount BIGINT, _method public.deposit_method,
  _package_id TEXT, _package_name TEXT, _receipt_url TEXT, _memo TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount <= 0 OR _amount > 100000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  INSERT INTO public.deposit_requests(user_id, amount, method, package_id, package_name, receipt_url, memo)
    VALUES (_uid, _amount, _method, _package_id, _package_name, _receipt_url, _memo)
    RETURNING id INTO _id;
  RETURN jsonb_build_object('ok',true,'id',_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_deposit(_request_id UUID, _action TEXT, _reason TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.deposit_requests%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _row FROM public.deposit_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'invalid_state'; END IF;

  IF _action = 'approve' THEN
    SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_row.user_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallet_balances(user_id) VALUES (_row.user_id) RETURNING * INTO _wallet;
    END IF;
    UPDATE public.wallet_balances SET
      available_balance = available_balance + _row.amount,
      total_balance = total_balance + _row.amount,
      updated_at = now()
    WHERE user_id=_row.user_id;
    UPDATE public.deposit_requests SET status='approved', approved_at=now(), admin_id=_uid WHERE id=_request_id;
    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
      VALUES (_row.user_id,'deposit_credit','credit',_row.amount,
              _wallet.total_balance + _row.amount, _wallet.available_balance + _row.amount,
              _request_id::text,
              jsonb_build_object('method',_row.method,'package_id',_row.package_id));
  ELSIF _action = 'reject' THEN
    UPDATE public.deposit_requests SET status='rejected', rejected_reason=_reason, admin_id=_uid WHERE id=_request_id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  RETURN jsonb_build_object('ok',true,'action',_action);
END $$;

-- =========================================================
-- PHASE 14: admin_set_tier / admin_adjust_balance
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_set_tier(_target UUID, _tier public.user_tier)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET tier=_tier, updated_at=now() WHERE id=_target;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_target UUID, _delta BIGINT, _reason TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid UUID := auth.uid();
  _wallet public.wallet_balances%ROWTYPE;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_target FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances(user_id) VALUES (_target) RETURNING * INTO _wallet;
  END IF;
  IF _wallet.available_balance + _delta < 0 THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  UPDATE public.wallet_balances SET
    available_balance = available_balance + _delta,
    total_balance = total_balance + _delta,
    updated_at=now()
  WHERE user_id=_target;

  INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, metadata)
    VALUES (_target,'admin_adjust', CASE WHEN _delta>=0 THEN 'credit' ELSE 'debit' END,
            ABS(_delta), _wallet.total_balance + _delta, _wallet.available_balance + _delta,
            jsonb_build_object('admin',_uid,'reason',_reason));

  RETURN jsonb_build_object('ok',true,'new_available',_wallet.available_balance + _delta);
END $$;

-- =========================================================
-- PHASE 15: bump_jackpot
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_jackpot(_amount BIGINT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  UPDATE public.jackpot_pool SET amount = amount + _amount, updated_at=now() WHERE id=1;
  RETURN jsonb_build_object('ok',true);
END $$;

-- =========================================================
-- PHASE 11: _cron_settle_package_daily (internal)
-- =========================================================
CREATE OR REPLACE FUNCTION public._cron_settle_package_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _r RECORD;
  _count INT := 0;
  _wallet public.wallet_balances%ROWTYPE;
BEGIN
  FOR _r IN
    SELECT * FROM public.package_purchases
    WHERE status='active' AND next_settle_at <= now()
    FOR UPDATE
  LOOP
    SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_r.user_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.wallet_balances SET
      available_balance = available_balance + _r.daily_return,
      total_balance = total_balance + _r.daily_return,
      updated_at = now()
    WHERE user_id=_r.user_id;

    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
      VALUES (_r.user_id,'package_settle','credit',_r.daily_return,
              _wallet.total_balance + _r.daily_return,
              _wallet.available_balance + _r.daily_return,
              _r.id::text,
              jsonb_build_object('package_id',_r.package_id));

    IF _r.settled_count + 1 >= _r.duration_days THEN
      UPDATE public.package_purchases SET settled_count=settled_count+1, total_settled=total_settled+_r.daily_return,
        status='completed', completed_at=now(), next_settle_at=NULL WHERE id=_r.id;
    ELSE
      UPDATE public.package_purchases SET settled_count=settled_count+1, total_settled=total_settled+_r.daily_return,
        next_settle_at = now() + interval '1 day' WHERE id=_r.id;
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'settled',_count);
END $$;

-- =========================================================
-- PHASE 16: lock down EXECUTE on definer functions
-- =========================================================
REVOKE EXECUTE ON FUNCTION public._cron_settle_package_daily() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.distribute_profit_share(BIGINT, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_withdrawal(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_package(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_deposit(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_tier(UUID, public.user_tier) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(UUID, BIGINT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_package_daily() FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_mission(TEXT, BOOLEAN, BIGINT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_deposit(BIGINT, public.deposit_method, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_package_purchase(TEXT, TEXT, BIGINT, BIGINT, INT, BIGINT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(BIGINT, public.withdrawal_method, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bump_jackpot(BIGINT) FROM anon;

-- claim_daily_attendance + reset_daily_mission_count had no search_path
ALTER FUNCTION public.claim_daily_attendance(UUID) SET search_path = public;
ALTER FUNCTION public.reset_daily_mission_count() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.reset_daily_mission_count() FROM PUBLIC, anon, authenticated;

-- tier_limits had RLS disabled — enable + readable
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tl_public_read ON public.tier_limits;
CREATE POLICY tl_public_read ON public.tier_limits FOR SELECT USING (true);

-- =========================================================
-- PHASE 13: storage bucket for receipts
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts','receipts',false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_user_upload" ON storage.objects;
CREATE POLICY "receipts_user_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "receipts_user_read" ON storage.objects;
CREATE POLICY "receipts_user_read" ON storage.objects FOR SELECT
  USING (bucket_id='receipts' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "receipts_user_delete" ON storage.objects;
CREATE POLICY "receipts_user_delete" ON storage.objects FOR DELETE
  USING (bucket_id='receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
