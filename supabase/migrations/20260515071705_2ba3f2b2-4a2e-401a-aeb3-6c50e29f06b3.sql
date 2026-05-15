-- =====================================================================
-- 1. slot_games schema extension + seed (3 games, distinct volatility)
-- =====================================================================
ALTER TABLE public.slot_games
  ADD COLUMN IF NOT EXISTS volatility_class text NOT NULL DEFAULT 'mid',
  ADD COLUMN IF NOT EXISTS bonus_frequency int  NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS paytable jsonb,
  ADD COLUMN IF NOT EXISTS symbol_weights jsonb,
  ADD COLUMN IF NOT EXISTS bonus_table jsonb;

-- Olympus 1000 — MID volatility (existing defaults)
UPDATE public.slot_games SET
  volatility_class = 'mid',
  bonus_frequency = 180,
  max_multiplier  = 1000,
  buy_bonus_multiplier = 100,
  symbol_weights = '[28,26,22,18,14,10,8,6,3,2,3]'::jsonb,
  paytable = jsonb_build_array(
    jsonb_build_array(0.2,0.5,1.5),
    jsonb_build_array(0.2,0.5,1.5),
    jsonb_build_array(0.3,0.8,2.0),
    jsonb_build_array(0.4,1.0,2.5),
    jsonb_build_array(0.5,1.5,4.0),
    jsonb_build_array(1.0,3.0,8.0),
    jsonb_build_array(1.5,5.0,12.0),
    jsonb_build_array(2.5,8.0,25.0),
    jsonb_build_array(5.0,20.0,60.0),
    jsonb_build_array(5.0,20.0,60.0),
    jsonb_build_array(0,0,0)
  ),
  bonus_table = jsonb_build_object(
    'segs',    jsonb_build_array(2,3,5,10,20,50,100,1000),
    'weights', jsonb_build_array(300,250,180,130,80,40,18,2)
  )
WHERE game_code = 'olympus_1000';

-- Wizard 2000 — HIGH volatility (rare but huge)
INSERT INTO public.slot_games (
  game_code, name, studio, rtp, max_multiplier, "rows", reels, paylines,
  min_bet_phon, max_bet_phon, buy_bonus_multiplier, active,
  volatility_class, bonus_frequency, symbol_weights, paytable, bonus_table
) VALUES (
  'wizard_2000', 'Wizard 2000 by Phonara', 'Phonara Originals',
  96.00, 2000, 3, 5, 20,
  100, 100, 150, true,
  'high', 280,
  '[32,30,26,20,14,9,6,4,2,1,2]'::jsonb,
  jsonb_build_array(
    jsonb_build_array(0.2,0.5,1.5),
    jsonb_build_array(0.2,0.5,1.5),
    jsonb_build_array(0.3,0.8,2.0),
    jsonb_build_array(0.4,1.0,3.0),
    jsonb_build_array(0.5,2.0,6.0),
    jsonb_build_array(1.5,5.0,15.0),
    jsonb_build_array(2.0,8.0,25.0),
    jsonb_build_array(4.0,15.0,60.0),
    jsonb_build_array(10.0,40.0,150.0),
    jsonb_build_array(10.0,40.0,150.0),
    jsonb_build_array(0,0,0)
  ),
  jsonb_build_object(
    'segs',    jsonb_build_array(2,5,10,25,75,150,500,2000),
    'weights', jsonb_build_array(200,200,180,150,120,80,55,15)
  )
)
ON CONFLICT (game_code) DO UPDATE SET
  volatility_class = EXCLUDED.volatility_class,
  bonus_frequency  = EXCLUDED.bonus_frequency,
  max_multiplier   = EXCLUDED.max_multiplier,
  buy_bonus_multiplier = EXCLUDED.buy_bonus_multiplier,
  symbol_weights   = EXCLUDED.symbol_weights,
  paytable         = EXCLUDED.paytable,
  bonus_table      = EXCLUDED.bonus_table,
  active = true;

-- Dragon Empire — LOW volatility (frequent small wins)
INSERT INTO public.slot_games (
  game_code, name, studio, rtp, max_multiplier, "rows", reels, paylines,
  min_bet_phon, max_bet_phon, buy_bonus_multiplier, active,
  volatility_class, bonus_frequency, symbol_weights, paytable, bonus_table
) VALUES (
  'dragon_500', 'Dragon Empire 500 by Phonara', 'Phonara Originals',
  96.00, 500, 3, 5, 20,
  100, 100, 60, true,
  'low', 120,
  '[22,22,20,18,16,12,10,8,5,4,3]'::jsonb,
  jsonb_build_array(
    jsonb_build_array(0.3,0.8,2.0),
    jsonb_build_array(0.3,0.8,2.0),
    jsonb_build_array(0.4,1.0,2.5),
    jsonb_build_array(0.5,1.2,3.0),
    jsonb_build_array(0.6,1.8,5.0),
    jsonb_build_array(1.2,3.5,10.0),
    jsonb_build_array(1.8,5.5,14.0),
    jsonb_build_array(2.8,9.0,28.0),
    jsonb_build_array(4.0,15.0,40.0),
    jsonb_build_array(4.0,15.0,40.0),
    jsonb_build_array(0,0,0)
  ),
  jsonb_build_object(
    'segs',    jsonb_build_array(2,3,5,10,20,40,100,500),
    'weights', jsonb_build_array(400,300,200,80,40,20,8,2)
  )
)
ON CONFLICT (game_code) DO UPDATE SET
  volatility_class = EXCLUDED.volatility_class,
  bonus_frequency  = EXCLUDED.bonus_frequency,
  max_multiplier   = EXCLUDED.max_multiplier,
  buy_bonus_multiplier = EXCLUDED.buy_bonus_multiplier,
  symbol_weights   = EXCLUDED.symbol_weights,
  paytable         = EXCLUDED.paytable,
  bonus_table      = EXCLUDED.bonus_table,
  active = true;

-- =====================================================================
-- 2. Engine extension — per-game paytable / weights / bonus / max_mult
--    Keeps existing 5-arg signature working; adds an 8-arg overload
--    that accepts jsonb config + max cap.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._slot_compute_spin(
  _server_seed text, _client_seed text, _nonce bigint, _is_buy_bonus boolean,
  _rtp_boost_pct numeric DEFAULT 0,
  _symbol_weights jsonb DEFAULT NULL,
  _paytable jsonb DEFAULT NULL,
  _bonus_table jsonb DEFAULT NULL,
  _max_mult numeric DEFAULT 1000
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public','extensions'
AS $function$
DECLARE
  combined_seed BIGINT; reel INT; row_i INT; rnd NUMERIC; sym INT;
  symbols INT[][] := ARRAY[ARRAY[0,0,0,0,0],ARRAY[0,0,0,0,0],ARRAY[0,0,0,0,0]];
  symbol_weights INT[];
  total_weight INT := 0; cum INT; w INT; i INT;
  scatter_count INT := 0; bonus_triggered BOOLEAN := false; bonus_mult INT := 0;
  paylines INT[][] := ARRAY[
    ARRAY[1,1,1,1,1], ARRAY[0,0,0,0,0], ARRAY[2,2,2,2,2],
    ARRAY[0,1,2,1,0], ARRAY[2,1,0,1,2],
    ARRAY[0,0,1,2,2], ARRAY[2,2,1,0,0],
    ARRAY[1,0,1,2,1], ARRAY[1,2,1,0,1],
    ARRAY[0,1,1,1,0], ARRAY[2,1,1,1,2],
    ARRAY[1,0,0,0,1], ARRAY[1,2,2,2,1],
    ARRAY[0,1,0,1,0], ARRAY[2,1,2,1,2],
    ARRAY[1,1,0,1,1], ARRAY[1,1,2,1,1],
    ARRAY[0,0,2,0,0], ARRAY[2,2,0,2,2],
    ARRAY[0,2,1,2,0]
  ];
  payouts NUMERIC[][];
  total_payout_mult NUMERIC := 0; win_lines JSONB := '[]'::jsonb;
  line_idx INT; line_first INT; line_count INT; match_sym INT; cell_sym INT; k INT;
  bonus_segs NUMERIC[]; bonus_w INT[];
  bonus_w_total INT := 0; bonus_rnd NUMERIC; bonus_cum INT;
  jrow jsonb; jcell jsonb;
BEGIN
  -- Default weights (Olympus baseline) when caller passes null
  IF _symbol_weights IS NULL THEN
    symbol_weights := ARRAY[28,26,22,18,14,10,8,6,3,2,3];
  ELSE
    symbol_weights := ARRAY(SELECT (value)::int FROM jsonb_array_elements(_symbol_weights));
  END IF;

  -- Default paytable (Olympus)
  IF _paytable IS NULL THEN
    payouts := ARRAY[
      ARRAY[0.2,0.5,1.5], ARRAY[0.2,0.5,1.5], ARRAY[0.3,0.8,2.0],
      ARRAY[0.4,1.0,2.5], ARRAY[0.5,1.5,4.0], ARRAY[1.0,3.0,8.0],
      ARRAY[1.5,5.0,12.0], ARRAY[2.5,8.0,25.0],
      ARRAY[5.0,20.0,60.0], ARRAY[5.0,20.0,60.0], ARRAY[0,0,0]
    ];
  ELSE
    -- 11 rows × 3 cols
    payouts := ARRAY(
      SELECT ARRAY(SELECT (cell)::numeric FROM jsonb_array_elements(jrow_x) cell)
      FROM jsonb_array_elements(_paytable) jrow_x
    );
  END IF;

  -- Default bonus table (Olympus)
  IF _bonus_table IS NULL THEN
    bonus_segs := ARRAY[2,3,5,10,20,50,100,1000]::numeric[];
    bonus_w    := ARRAY[300,250,180,130,80,40,18,2];
  ELSE
    bonus_segs := ARRAY(SELECT (value)::numeric FROM jsonb_array_elements(_bonus_table->'segs'));
    bonus_w    := ARRAY(SELECT (value)::int     FROM jsonb_array_elements(_bonus_table->'weights'));
  END IF;

  combined_seed := ('x' || substr(encode(extensions.digest(_server_seed || ':' || _client_seed || ':' || _nonce::text, 'sha256'), 'hex'), 1, 12))::BIT(48)::BIGINT;
  FOREACH w IN ARRAY symbol_weights LOOP total_weight := total_weight + w; END LOOP;

  FOR reel IN 0..4 LOOP
    FOR row_i IN 0..2 LOOP
      rnd := public._slot_mulberry32(combined_seed, reel * 3 + row_i);
      cum := 0; sym := 0;
      FOR i IN 1..array_length(symbol_weights,1) LOOP
        cum := cum + symbol_weights[i];
        IF rnd * total_weight < cum THEN sym := i - 1; EXIT; END IF;
      END LOOP;
      symbols[row_i + 1][reel + 1] := sym;
      IF sym = 10 THEN scatter_count := scatter_count + 1; END IF;
    END LOOP;
  END LOOP;

  FOR line_idx IN 1..array_length(paylines,1) LOOP
    line_first := symbols[paylines[line_idx][1] + 1][1];
    IF line_first = 10 THEN CONTINUE; END IF;
    match_sym := line_first;
    IF match_sym = 9 THEN
      FOR k IN 2..5 LOOP
        cell_sym := symbols[paylines[line_idx][k] + 1][k];
        IF cell_sym <> 9 AND cell_sym <> 10 THEN match_sym := cell_sym; EXIT; END IF;
      END LOOP;
    END IF;
    line_count := 1;
    FOR k IN 2..5 LOOP
      cell_sym := symbols[paylines[line_idx][k] + 1][k];
      IF cell_sym = match_sym OR cell_sym = 9 THEN line_count := line_count + 1; ELSE EXIT; END IF;
    END LOOP;
    IF line_count >= 3 AND match_sym BETWEEN 0 AND 9 THEN
      total_payout_mult := total_payout_mult + payouts[match_sym + 1][line_count - 2];
      win_lines := win_lines || jsonb_build_object('line', line_idx, 'symbol', match_sym, 'count', line_count, 'mult', payouts[match_sym + 1][line_count - 2]);
    END IF;
  END LOOP;

  IF scatter_count >= 3 OR _is_buy_bonus THEN
    bonus_triggered := true;
    FOREACH w IN ARRAY bonus_w LOOP bonus_w_total := bonus_w_total + w; END LOOP;
    bonus_rnd := public._slot_mulberry32(combined_seed, 999);
    bonus_cum := 0;
    FOR i IN 1..array_length(bonus_w,1) LOOP
      bonus_cum := bonus_cum + bonus_w[i];
      IF bonus_rnd * bonus_w_total < bonus_cum THEN bonus_mult := bonus_segs[i]::INT; EXIT; END IF;
    END LOOP;
    total_payout_mult := total_payout_mult + bonus_mult;
  END IF;

  IF _rtp_boost_pct > 0 THEN
    total_payout_mult := total_payout_mult * (1 + _rtp_boost_pct / 100.0);
  END IF;
  IF total_payout_mult > _max_mult THEN total_payout_mult := _max_mult; END IF;

  RETURN jsonb_build_object(
    'symbols', to_jsonb(symbols),
    'win_lines', win_lines,
    'payout_mult', total_payout_mult,
    'scatter_count', scatter_count,
    'bonus_triggered', bonus_triggered,
    'bonus_multiplier', bonus_mult
  );
END; $function$;

-- =====================================================================
-- 3. spin_slot_demo — pass per-game config; widen RTP band 98.5~101.5
-- =====================================================================
CREATE OR REPLACE FUNCTION public.spin_slot_demo(
  _game_code text, _bet_chips numeric, _client_seed text, _is_buy_bonus boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_game record;
  v_balance numeric;
  v_bet_total numeric;
  v_server_seed text;
  v_nonce bigint;
  v_result jsonb;
  v_payout numeric;
  v_class text;
  v_chosen_class text := 'loss';
  v_total_bet numeric; v_total_paid numeric;
  v_win_streak int; v_loss_streak int; v_last_class text; v_spins int;
  v_rtp numeric;
  v_lo numeric := 98.5;
  v_hi numeric := 101.5;
  v_desired text;
  v_pattern text := 'cruise';
  v_attempts int := 0; v_max_attempts int := 16;
  v_best jsonb; v_best_class text := 'loss'; v_best_rank int := -1;
  v_class_rank int; v_desired_rank int;
  v_rng numeric;
  v_streak_boost numeric := 0;
  v_big_mult numeric := 1.0;
  v_buy_bonus_boost numeric := 1.85;
  v_max_mult numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_game FROM public.slot_games WHERE game_code = _game_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'game_not_found'; END IF;
  v_max_mult := COALESCE(v_game.max_multiplier, 1000);

  IF _bet_chips IS NULL OR _bet_chips <= 0 THEN RAISE EXCEPTION 'bet_invalid'; END IF;
  IF _client_seed IS NULL OR btrim(_client_seed) = '' THEN RAISE EXCEPTION 'client_seed_required'; END IF;

  v_bet_total := CASE WHEN COALESCE(_is_buy_bonus,false) THEN _bet_chips * v_game.buy_bonus_multiplier ELSE _bet_chips END;

  INSERT INTO public.slot_demo_balances (user_id, balance_chips, last_refill_at)
  VALUES (v_user, 10000, now()) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_chips, total_bet, total_paid, win_streak, loss_streak, last_class, spins_count
    INTO v_balance, v_total_bet, v_total_paid, v_win_streak, v_loss_streak, v_last_class, v_spins
  FROM public.slot_demo_balances WHERE user_id = v_user FOR UPDATE;

  IF v_balance < v_bet_total THEN RAISE EXCEPTION 'insufficient_demo_chips'; END IF;

  UPDATE public.slot_demo_balances
     SET balance_chips = balance_chips - v_bet_total,
         total_bet = total_bet + v_bet_total,
         spins_count = spins_count + 1,
         updated_at = now()
   WHERE user_id = v_user;
  v_total_bet := v_total_bet + v_bet_total;
  v_spins := v_spins + 1;

  v_rtp := CASE WHEN v_total_bet > 0 THEN (v_total_paid / v_total_bet) * 100 ELSE 100 END;

  IF v_win_streak BETWEEN 3 AND 5 THEN
    v_streak_boost := 0.22; v_big_mult := 1.0; v_pattern := 'streak_3_5';
  ELSIF v_win_streak BETWEEN 6 AND 8 THEN
    v_streak_boost := 0.38; v_big_mult := 2.5; v_pattern := 'streak_6_8';
  ELSIF v_win_streak >= 9 THEN
    v_streak_boost := 0.0;  v_big_mult := 3.0; v_pattern := 'streak_9_plus';
  END IF;

  v_rng := random();

  IF COALESCE(_is_buy_bonus,false) THEN
    v_pattern := 'buy_bonus';
    v_desired := CASE WHEN v_rng < 0.18 THEN 'huge'
                      WHEN v_rng < 0.55 THEN 'big'
                      ELSE 'medium' END;
  ELSIF v_spins <= 8 THEN
    v_pattern := 'honeymoon';
    v_desired := CASE WHEN v_rng < 0.52 THEN 'small'
                      WHEN v_rng < 0.80 THEN 'medium'
                      ELSE 'near_miss' END;
  ELSIF v_win_streak >= 9 THEN
    v_desired := CASE WHEN v_rng < 0.55 THEN 'huge'
                      WHEN v_rng < 0.85 THEN 'big'
                      ELSE 'near_miss' END;
  ELSIF v_rtp < v_lo THEN
    v_pattern := 'rtp_recover';
    IF (v_lo - v_rtp) > 5 THEN
      v_desired := CASE WHEN v_rng < 0.12 THEN 'huge'
                        WHEN v_rng < 0.50 THEN 'big'
                        ELSE 'medium' END;
    ELSE
      v_desired := CASE WHEN v_rng < 0.45 THEN 'medium'
                        WHEN v_rng < 0.85 THEN 'small'
                        ELSE 'big' END;
    END IF;
  ELSIF v_rtp > v_hi THEN
    v_pattern := 'rtp_cool';
    v_desired := CASE WHEN v_rng < 0.35 THEN 'near_miss'
                      WHEN v_rng < 0.85 THEN 'loss'
                      ELSE 'small' END;
  ELSIF v_loss_streak >= 5 THEN
    v_pattern := 'mercy_big';
    v_desired := CASE WHEN v_rng < 0.25 THEN 'big'
                      WHEN v_rng < 0.70 THEN 'medium'
                      ELSE 'small' END;
  ELSIF v_loss_streak >= 3 THEN
    v_pattern := 'mercy_small';
    v_desired := CASE WHEN v_rng < 0.50 THEN 'small'
                      WHEN v_rng < 0.78 THEN 'medium'
                      ELSE 'near_miss' END;
  ELSIF v_win_streak BETWEEN 3 AND 8 THEN
    v_pattern := 'streak_climb';
    v_desired := CASE
      WHEN v_rng < (0.10 * v_big_mult)            THEN 'big'
      WHEN v_rng < (0.10 * v_big_mult + 0.30 + v_streak_boost*0.5) THEN 'medium'
      WHEN v_rng < (0.10 * v_big_mult + 0.65 + v_streak_boost*0.5) THEN 'small'
      ELSE 'near_miss'
    END;
  ELSE
    v_pattern := 'cruise';
    v_desired := CASE WHEN v_rng < 0.35 THEN 'near_miss'
                      WHEN v_rng < 0.73 THEN 'small'
                      WHEN v_rng < 0.90 THEN 'medium'
                      ELSE 'loss' END;
  END IF;

  v_desired_rank := CASE v_desired
    WHEN 'huge' THEN 6 WHEN 'big' THEN 5 WHEN 'medium' THEN 4
    WHEN 'small' THEN 3 WHEN 'near_miss' THEN 2 ELSE 1 END;

  WHILE v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;
    v_server_seed := encode(extensions.gen_random_bytes(32), 'hex');
    v_nonce := (extract(epoch FROM clock_timestamp()) * 1000)::bigint + v_attempts;
    v_result := public._slot_compute_spin(
      v_server_seed, _client_seed, v_nonce, COALESCE(_is_buy_bonus,false), 0,
      v_game.symbol_weights, v_game.paytable, v_game.bonus_table, v_max_mult
    );
    v_class := public._slot_demo_classify(v_result, _bet_chips);

    IF v_class = v_desired THEN
      v_best := v_result; v_best_class := v_class; EXIT;
    END IF;

    v_class_rank := CASE v_class
      WHEN 'huge' THEN 6 WHEN 'big' THEN 5 WHEN 'medium' THEN 4
      WHEN 'small' THEN 3 WHEN 'near_miss' THEN 2 ELSE 1 END;

    IF v_best IS NULL OR ABS(v_class_rank - v_desired_rank) < ABS(v_best_rank - v_desired_rank) THEN
      v_best := v_result; v_best_class := v_class; v_best_rank := v_class_rank;
    END IF;
  END LOOP;

  v_result := v_best; v_chosen_class := v_best_class;

  v_payout := _bet_chips * COALESCE((v_result->>'payout_mult')::numeric, 0);

  IF COALESCE(_is_buy_bonus,false) AND v_payout > 0 THEN
    v_payout := v_payout * v_buy_bonus_boost;
  END IF;

  -- RTP overshoot guard (cap relative to bet, never above max_mult)
  IF v_rtp > v_hi AND v_payout > _bet_chips * 5 THEN
    v_payout := _bet_chips * (1 + random() * 2);
    v_chosen_class := 'small';
  END IF;
  IF v_payout > _bet_chips * v_max_mult THEN
    v_payout := _bet_chips * v_max_mult;
  END IF;

  IF v_payout > 0 THEN
    UPDATE public.slot_demo_balances
       SET balance_chips = balance_chips + v_payout, total_paid = total_paid + v_payout,
           win_streak = win_streak + 1, loss_streak = 0, last_class = v_chosen_class, updated_at = now()
     WHERE user_id = v_user;
  ELSE
    UPDATE public.slot_demo_balances
       SET win_streak = 0, loss_streak = loss_streak + 1, last_class = v_chosen_class, updated_at = now()
     WHERE user_id = v_user;
  END IF;

  SELECT balance_chips INTO v_balance FROM public.slot_demo_balances WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'symbols', v_result->'symbols',
    'win_lines', v_result->'win_lines',
    'payout_chips', v_payout,
    'bet_chips', v_bet_total,
    'balance_chips', v_balance,
    'bonus_triggered', COALESCE(v_result->'bonus_triggered','false'::jsonb),
    'bonus_multiplier', v_result->'bonus_multiplier',
    'client_seed', _client_seed,
    'nonce', v_nonce,
    'server_seed_hash', encode(extensions.digest(v_server_seed,'sha256'),'hex'),
    'demo_meta', jsonb_build_object(
      'game_code', _game_code,
      'volatility', v_game.volatility_class,
      'class', v_chosen_class, 'desired', v_desired, 'pattern_type', v_pattern,
      'rtp', round(v_rtp,2), 'applied_rtp_band', jsonb_build_array(v_lo, v_hi),
      'streak_boost', v_streak_boost, 'big_mult', v_big_mult,
      'win_streak', CASE WHEN v_payout > 0 THEN v_win_streak + 1 ELSE 0 END,
      'loss_streak', CASE WHEN v_payout > 0 THEN 0 ELSE v_loss_streak + 1 END
    )
  );
END; $function$;

-- =====================================================================
-- 4. spin_slot_real — pass per-game config; 50× hard cap on extreme RTP
-- =====================================================================
CREATE OR REPLACE FUNCTION public.spin_slot_real(
  _game_code text, _bet_phon numeric, _client_seed text, _is_buy_bonus boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_game record;
  v_balance numeric;
  v_bet_total numeric;
  v_server_seed text; v_server_seed_hash text; v_nonce bigint;
  v_result jsonb; v_payout numeric;
  v_nft_boost numeric := 0;
  v_streak_boost numeric := 0;
  v_total_boost numeric := 0;
  v_kill record;
  v_recent_wins int := 0;
  v_recent_bet numeric := 0;
  v_recent_paid numeric := 0;
  v_recent_rtp numeric := 100;
  v_target_rtp_lo numeric := 94.8;
  v_target_rtp_hi numeric := 95.8;
  v_max_mult numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF public.is_account_frozen(v_user) THEN RAISE EXCEPTION 'account_frozen'; END IF;

  SELECT key, enabled INTO v_kill FROM public.platform_kill_switches WHERE key = 'trading_halt';
  IF FOUND AND v_kill.enabled THEN RAISE EXCEPTION 'trading_halted'; END IF;

  SELECT * INTO v_game FROM public.slot_games WHERE game_code = _game_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'game_not_found'; END IF;
  v_max_mult := COALESCE(v_game.max_multiplier, 1000);

  IF _bet_phon < v_game.min_bet_phon OR _bet_phon > v_game.max_bet_phon THEN
    RAISE EXCEPTION 'bet_out_of_range';
  END IF;

  v_bet_total := CASE WHEN _is_buy_bonus THEN _bet_phon * v_game.buy_bonus_multiplier ELSE _bet_phon END;

  BEGIN
    SELECT LEAST(public.get_my_total_boost_pct(),100) * 0.005 INTO v_nft_boost;
    IF v_nft_boost > 0.25 THEN v_nft_boost := 0.25; END IF;
  EXCEPTION WHEN OTHERS THEN v_nft_boost := 0; END;

  SELECT
    COUNT(*) FILTER (WHERE payout_phon > 0),
    COALESCE(SUM(bet_phon),0),
    COALESCE(SUM(payout_phon),0)
  INTO v_recent_wins, v_recent_bet, v_recent_paid
  FROM (
    SELECT bet_phon, payout_phon FROM public.slot_spins
     WHERE user_id = v_user AND game_code = _game_code
     ORDER BY created_at DESC LIMIT 10
  ) s;

  v_recent_rtp := CASE WHEN v_recent_bet > 0 THEN (v_recent_paid / v_recent_bet) * 100 ELSE 95 END;

  IF v_recent_rtp < v_target_rtp_lo THEN
    v_streak_boost := LEAST(0.08, (v_target_rtp_lo - v_recent_rtp) * 0.005);
  END IF;

  v_total_boost := LEAST(0.30, v_nft_boost + v_streak_boost);

  SELECT balance INTO v_balance FROM public.phon_balances WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_bet_total THEN RAISE EXCEPTION 'insufficient_phon'; END IF;

  UPDATE public.phon_balances SET balance = balance - v_bet_total, updated_at = now() WHERE user_id = v_user;

  v_server_seed := encode(extensions.gen_random_bytes(32),'hex');
  v_server_seed_hash := encode(extensions.digest(v_server_seed,'sha256'),'hex');
  v_nonce := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;

  v_result := public._slot_compute_spin(
    v_server_seed, _client_seed, v_nonce, _is_buy_bonus, v_total_boost,
    v_game.symbol_weights, v_game.paytable, v_game.bonus_table, v_max_mult
  );
  v_payout := _bet_phon * (v_result->>'payout_mult')::numeric;

  -- Hard 50× cap when running far above target band
  IF v_recent_rtp > (v_target_rtp_hi + 10) AND v_payout > _bet_phon * 50 THEN
    v_payout := _bet_phon * 50;
  END IF;
  -- Never exceed game-specific max multiplier
  IF v_payout > _bet_phon * v_max_mult THEN
    v_payout := _bet_phon * v_max_mult;
  END IF;

  IF v_payout > 0 THEN
    UPDATE public.phon_balances SET balance = balance + v_payout, updated_at = now() WHERE user_id = v_user;
  END IF;

  INSERT INTO public.slot_spins(user_id, game_code, bet_phon, payout_phon, symbols, win_lines, bonus_triggered, bonus_multiplier, is_buy_bonus, server_seed_hash, server_seed_revealed, client_seed, nonce)
  VALUES (v_user, _game_code, v_bet_total, v_payout, v_result->'symbols', v_result->'win_lines',
          (v_result->>'bonus_triggered')::boolean, NULLIF((v_result->>'bonus_multiplier')::int, 0),
          _is_buy_bonus, v_server_seed_hash, v_server_seed, _client_seed, v_nonce);

  RETURN jsonb_build_object(
    'symbols', v_result->'symbols',
    'win_lines', v_result->'win_lines',
    'payout_phon', v_payout,
    'bet_phon', v_bet_total,
    'bonus_triggered', v_result->'bonus_triggered',
    'bonus_multiplier', v_result->'bonus_multiplier',
    'server_seed_hash', v_server_seed_hash,
    'server_seed', v_server_seed,
    'client_seed', _client_seed,
    'nonce', v_nonce,
    'rtp_boost_pct', v_total_boost,
    'real_meta', jsonb_build_object(
      'mode', 'real_fair',
      'game_code', _game_code,
      'volatility', v_game.volatility_class,
      'recent_rtp', round(v_recent_rtp, 2),
      'target_rtp_band', jsonb_build_array(v_target_rtp_lo, v_target_rtp_hi),
      'nft_boost', v_nft_boost,
      'streak_boost', v_streak_boost,
      'total_boost', v_total_boost,
      'recent_wins_10', v_recent_wins,
      'max_multiplier', v_max_mult
    )
  );
END; $function$;

-- =====================================================================
-- 5. Streak lookup index (real-mode last-10 query)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_slot_spins_user_game_recent
  ON public.slot_spins (user_id, game_code, created_at DESC);

GRANT EXECUTE ON FUNCTION public.spin_slot_demo(text, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_slot_real(text, numeric, text, boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';