
-- Phase 22: Admin advanced analytics RPCs

CREATE OR REPLACE FUNCTION public.get_ai_bot_stats(_days integer DEFAULT 30)
RETURNS TABLE(
  day date,
  kind ai_bot_kind,
  runs bigint,
  claimed bigint,
  failed bigint,
  total_reward bigint,
  avg_pnl_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int := GREATEST(1, LEAST(_days, 365));
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    r.created_at::date AS day,
    r.kind,
    COUNT(*)::bigint AS runs,
    COUNT(*) FILTER (WHERE r.status='claimed')::bigint AS claimed,
    COUNT(*) FILTER (WHERE r.status='failed')::bigint AS failed,
    COALESCE(SUM(r.reward),0)::bigint AS total_reward,
    COALESCE(AVG(r.trading_pnl_pct) FILTER (WHERE r.kind='trading' AND r.trading_pnl_pct IS NOT NULL),0)::numeric AS avg_pnl_pct
  FROM public.ai_bot_runs r
  WHERE r.created_at >= CURRENT_DATE - (_n - 1)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END $$;

CREATE OR REPLACE FUNCTION public.get_tier_distribution()
RETURNS TABLE(tier user_tier, users bigint, total_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.tier,
    COUNT(*)::bigint,
    COALESCE(SUM(w.total_balance),0)::bigint
  FROM public.profiles p
  LEFT JOIN public.wallet_balances w ON w.user_id=p.id
  GROUP BY p.tier
  ORDER BY p.tier;
END $$;

CREATE OR REPLACE FUNCTION public.get_top_users(_limit integer DEFAULT 10)
RETURNS TABLE(user_id uuid, nickname text, tier user_tier, total_earned bigint, today_earned bigint, total_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _n int := GREATEST(1, LEAST(_limit, 100));
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.nickname, p.tier,
    COALESCE(w.monthly_earned,0)::bigint,
    COALESCE(w.today_earned,0)::bigint,
    COALESCE(w.total_balance,0)::bigint
  FROM public.profiles p
  LEFT JOIN public.wallet_balances w ON w.user_id=p.id
  ORDER BY COALESCE(w.total_balance,0) DESC
  LIMIT _n;
END $$;

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(inviter_id uuid, nickname text, tier user_tier, invited bigint, total_commission bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _n int := GREATEST(1, LEAST(_limit, 100));
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT r.inviter_id, p.nickname, p.tier,
    COUNT(*)::bigint,
    COALESCE(SUM(r.total_commission),0)::bigint
  FROM public.referrals r
  JOIN public.profiles p ON p.id=r.inviter_id
  GROUP BY r.inviter_id, p.nickname, p.tier
  ORDER BY 4 DESC, 5 DESC
  LIMIT _n;
END $$;
