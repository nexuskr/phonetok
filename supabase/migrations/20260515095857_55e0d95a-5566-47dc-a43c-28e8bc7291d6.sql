INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
VALUES (
  'get_slot_leaderboard',
  'text, text, text, integer',
  ARRAY['authenticated'],
  'slot',
  'Slot leaderboard — masks nicknames via mask_nickname()'
)
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles,
      category = EXCLUDED.category,
      note = EXCLUDED.note,
      updated_at = now();