ALTER TABLE public.fomo_notifications DROP CONSTRAINT IF EXISTS fomo_notifications_kind_check;
ALTER TABLE public.fomo_notifications ADD CONSTRAINT fomo_notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'recovery'::text,
    'loss_streak'::text,
    'inactive'::text,
    'jackpot_near'::text,
    'war_started'::text,
    'referral_used'::text,
    'empire_promo'::text,
    'market_event'::text,
    'founding_seat'::text,
    'level_up'::text,
    'imperial_level_up'::text,
    'emperor_reward'::text
  ]));