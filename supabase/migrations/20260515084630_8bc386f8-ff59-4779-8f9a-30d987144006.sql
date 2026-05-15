
-- 7 new server-authoritative slot games. Paytable/weights derived from V7 sim
-- (1M-round verified: 95.7-99.4% RTP). Bonus table = wheel approximation of
-- each mechanic's EV until per-mechanic engine v2 lands.

INSERT INTO public.slot_games
  (game_code, name, studio, rtp, max_multiplier, rows, reels, paylines,
   min_bet_phon, max_bet_phon, buy_bonus_multiplier, active,
   volatility_class, bonus_frequency, paytable, symbol_weights, bonus_table)
VALUES
-- 1) Cosmic Forge — high · MAX 5000× · sticky multiplier (wheel fallback)
('cosmic_forge_5000', 'Cosmic Forge 5000 by Phonara', 'Phonara Gaming',
 96.00, 5000, 3, 5, 20, 1, 100, 100, true, 'high', 130,
 -- paytable[symbolIdx][0..2] = pay for 3,4,5-of-a-kind
 '[[0.26,0.78,2.07],[0.26,0.78,2.07],[0.39,1.04,2.59],[0.39,1.04,2.59],[0.52,1.30,3.10],[1.30,3.89,10.36],[1.55,5.18,12.95],[2.07,6.47,18.13],[2.59,10.36,31.07],[0,0,0],[0,0,0]]'::jsonb,
 '[25,25,22,22,18,9,7,5,3,3,4]'::jsonb,
 '{"segs":[3,8,20,50,150,500,5000],"weights":[280,260,210,150,65,30,5]}'::jsonb),

-- 2) Neon Tokyo 88 — very high · MAX 8888× · hold & spin (wheel fallback)
('neon_tokyo_88', 'Neon Tokyo 88 by Phonara', 'Phonara Gaming',
 96.00, 8888, 3, 5, 20, 1, 100, 100, true, 'high', 200,
 '[[0.44,1.34,3.57],[0.44,1.34,3.57],[0.67,1.78,4.46],[0.67,1.78,4.46],[0.89,2.23,5.36],[5.50,16.50,44.00],[6.60,22.00,55.00],[8.80,27.50,77.00],[11.00,44.00,132.00],[0,0,0],[0,0,0]]'::jsonb,
 '[26,26,24,24,20,8,6,4,2.5,2.5,3.5]'::jsonb,
 '{"segs":[5,15,40,100,300,888,8888],"weights":[260,250,220,170,75,22,3]}'::jsonb),

-- 3) Pirate''s Curse — mid · MAX 1500× · crash cannon (wheel fallback)
('pirates_curse_1500', 'Pirate''s Curse 1500 by Phonara', 'Phonara Gaming',
 96.00, 1500, 3, 5, 20, 1, 100, 100, true, 'mid', 92,
 '[[0.42,1.26,3.36],[0.42,1.26,3.36],[0.63,1.68,4.20],[0.63,1.68,4.20],[0.84,2.10,5.04],[2.10,6.30,16.80],[2.52,8.40,21.00],[3.36,10.50,29.40],[4.20,16.80,50.40],[0,0,0],[0,0,0]]'::jsonb,
 '[24,24,20,20,17,11,9,6,4,3,4.5]'::jsonb,
 '{"segs":[2,5,10,25,75,200,1500],"weights":[320,280,210,130,45,13,2]}'::jsonb),

-- 4) Pharaoh''s Vault — mid · MAX 2500× · pick & reveal (wheel fallback)
('pharaohs_vault_2500', 'Pharaoh''s Vault 2500 by Phonara', 'Phonara Gaming',
 96.00, 2500, 3, 5, 20, 1, 100, 100, true, 'mid', 94,
 '[[0.37,1.10,2.94],[0.37,1.10,2.94],[0.55,1.46,3.66],[0.55,1.46,3.66],[0.73,1.83,4.39],[1.83,5.52,14.62],[2.20,7.30,18.30],[2.94,9.14,25.59],[3.66,14.62,43.87],[0,0,0],[0,0,0]]'::jsonb,
 '[24,24,20,20,17,11,9,6,4,3,4.5]'::jsonb,
 '{"segs":[3,8,20,60,150,400,2500],"weights":[300,270,200,150,55,22,3]}'::jsonb),

-- 5) Viking Thunder — high · MAX 4000× · three-path free spins (wheel fallback)
('viking_thunder_4000', 'Viking Thunder 4000 by Phonara', 'Phonara Gaming',
 96.00, 4000, 3, 5, 20, 1, 100, 100, true, 'high', 127,
 '[[0.33,0.99,2.63],[0.33,0.99,2.63],[0.49,1.32,3.30],[0.49,1.32,3.30],[0.66,1.65,3.95],[1.65,4.94,13.17],[1.98,6.58,16.46],[2.63,8.23,23.04],[3.29,13.17,39.50],[0,0,0],[0,0,0]]'::jsonb,
 '[25,25,22,22,18,9,7,5,3,3,4]'::jsonb,
 '{"segs":[3,8,25,75,200,600,4000],"weights":[270,250,220,180,60,18,2]}'::jsonb),

-- 6) Aztec Sun — mid · MAX 1200× · cluster + tumble (wheel fallback)
('aztec_sun_1200', 'Aztec Sun 1200 by Phonara', 'Phonara Gaming',
 96.00, 1200, 3, 5, 20, 1, 100, 100, true, 'mid', 93,
 '[[0.27,0.80,2.14],[0.27,0.80,2.14],[0.40,1.07,2.67],[0.40,1.07,2.67],[0.53,1.34,3.21],[3.16,9.48,25.28],[3.79,12.64,31.60],[5.06,15.80,44.24],[6.32,25.28,75.84],[0,0,0],[0,0,0]]'::jsonb,
 '[24,24,20,20,17,11,9,6,4,3,4.5]'::jsonb,
 '{"segs":[3,10,30,80,200,500,1200],"weights":[260,240,200,180,80,35,5]}'::jsonb),

-- 7) Cherry Sakura — low · MAX 500× · mission trail (wheel fallback)
('cherry_sakura_500', 'Cherry Sakura 500 by Phonara', 'Phonara Gaming',
 96.00, 500, 3, 5, 20, 1, 100, 100, true, 'low', 65,
 '[[0.30,0.89,2.36],[0.30,0.89,2.36],[0.44,1.18,2.96],[0.44,1.18,2.96],[0.59,1.48,3.55],[1.48,4.44,11.83],[1.78,5.91,14.78],[2.36,7.39,20.68],[2.96,11.83,35.50],[0,0,0],[0,0,0]]'::jsonb,
 '[22,22,18,18,16,12,10,7,5,4,5]'::jsonb,
 '{"segs":[1,3,6,12,25,80,500],"weights":[380,300,180,90,35,13,2]}'::jsonb)

ON CONFLICT (game_code) DO UPDATE SET
  name = EXCLUDED.name,
  rtp = EXCLUDED.rtp,
  max_multiplier = EXCLUDED.max_multiplier,
  volatility_class = EXCLUDED.volatility_class,
  bonus_frequency = EXCLUDED.bonus_frequency,
  paytable = EXCLUDED.paytable,
  symbol_weights = EXCLUDED.symbol_weights,
  bonus_table = EXCLUDED.bonus_table,
  active = true;
