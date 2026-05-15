# Slots v3 — 최종 로드맵 (잔여 작업만)

이미 끝난 항목 제외:
- ✅ 7개 신규 슬롯 시드 / 테마 / 라우팅 / 로비
- ✅ 절차적 Web Audio 기본 사운드(`slotSound.ts`)
- ✅ Tier-2 보너스 오버레이 7종(StickyMulti / Hold88 / CrashCannon / PickReveal / ThreePath / ClusterTumble / MissionTrail) + BonusRouter
- ✅ `scripts/slot-sim.ts` 1M 시뮬 스크립트 골격
- ✅ Casino 로비 임포트 fix

남은 작업을 **의존성 → 안정성 → 체험 → 확장** 순서로 7단계.

---

## STAGE 1 — 서버 권위 모델 (RPC 게임별 분기 + buy-bonus)
> 모든 RTP/시뮬/모니터링은 서버 결정값 위에서만 의미가 있으므로 가장 먼저.

- `supabase/functions/slot-spin/` 게임 핸들러 분기:
  cosmic_forge_5000 / neon_tokyo_88 / pirates_curse_1500 /
  pharaohs_vault_2500 / viking_thunder_4000 / aztec_sun_1200 / cherry_sakura_500
  (각 핸들러는 `src/lib/slots/engine/games.ts`와 동일한 수학 프로파일을
  PL/pgSQL `_slot_compute_spin_<game>`로 미러).
- `slot_games` 테이블에 `buy_bonus_cost_mult numeric`, `max_payout_mult int` 컬럼 추가.
- 새 RPC `request_buy_bonus(game_code, bet)` — 비용·entry trigger·시드 모두 서버 결정.
- 클라 `slots-rpc.ts.spinReal/spinDemo` 응답에 `bonus_kind`, `bonus_seed`, `payout_segments[]`
  필드 추가 (오버레이 동기화용).

검증: 7게임 curl + DB row 확인.

---

## STAGE 2 — RTP v3 튜닝 + 100만 판 검증
- `scripts/slot-sim.ts --rounds=1000000 --game=all` 일괄 모드.
- 합격 기준: **RTP ∈ [0.955, 0.970]**, **bonus hit ∈ [1/120, 1/250]**, **maxX ≤ 게임별 캡**.
- binary search로 `pt()` 스케일 + `symbolWeights` + 보너스 trigger 확률 튜닝.
- 합격 가중치를 STAGE 1 서버 핸들러에 그대로 반영(드리프트 방지 단일 소스).
- 결과는 `.lovable/sim-report.md` 표로 출력.

---

## STAGE 3 — 보너스 오버레이 ↔ 서버 payout E2E 동기화
- `OlympusSlot`에서 오버레이 `onComplete(winAmount)` ≡ 서버 `payout` 강제.
- 차이 발생 시 → STAGE 4의 `slot_anomaly_log`로 자동 적재.
- vitest: `bonus-sync.test.ts` 7케이스(메커닉별 mock RPC → 라이프사이클 → payout 일치).

---

## STAGE 4 — 모니터링 (실패 스핀 / 사운드 에러 / payout 불일치)
- 신규 테이블 `slot_anomaly_log(user_id, game_code, kind, expected, actual, meta jsonb)`.
- `kind ∈ {spin_failed, sound_init_failed, payout_mismatch, overlay_timeout}`.
- 트리거: `payout_mismatch` 발생 시 `anomaly_events`(severity='warn')로 승격.
- `/admin/kpi`에 `<SlotAnomalyPanel />` 24h 카운트 + drill-down + 해결 처리.

---

## STAGE 5 — Pragmatic / Stake 급 사운드 시스템 (Howler + ElevenLabs)
> "엔진은 Olympus 1000 Base, 슬롯은 Sound Theme Pack 교체" 구조.

### 5-1. SoundManager (`src/lib/sound/SoundManager.ts`, Howler.js 기반)
- 단일 인스턴스. 레이어드 채널:
  `bgm` / `reel` / `stop` / `win` / `bigwin` / `scatter` / `bonus_trigger` /
  `bonus_loop` / `mech` (메커닉별 cue: sticky_lock, coin_drop, crash_tick, ...) / `vo`.
- 메서드: `loadPack(theme)`, `playBGM(fade)`, `crossfadeBGM`, `playReelSpin(speed)`,
  `playWinTier(amount, bet)` → Small(<5×) / Big(10×) / Huge(50×) / Mega(200×) / Epic(500×+),
  `playMechCue(name)`, `duck(target, db, ms)`, `pauseAll/resumeAll`(visibilitychange).
- 모바일: AudioContext lazy-unlock(첫 터치), `prefers-reduced-motion`/시스템 음소거 존중,
  background 시 BGM pause + reel mute, foreground 복귀 시 fade-in.
- `useSoundManager()` 훅 + `<SoundProvider />` (App 루트, theme prop으로 핫스왑).

### 5-2. Sound Theme Pack 인터페이스
```ts
type SoundPackV2 = {
  themeKey: SlotThemeKey;          // 'olympus' | 'wizard' | ...
  bgm: { url: string; loop: true; volume: number };
  reel: { spin: string; spinFast: string; stop: string[]; anticipation: string };
  win: { small: string; big: string; huge: string; mega: string; epic: string };
  vo:  { bigWin?: string; megaWin?: string; epic?: string };
  scatter: { hit: string; trigger: string };
  mech: Partial<Record<MechCue, string>>;  // 메커닉 cue 키 → URL
};
```
- 8개 팩(요청대로 7개 신규 + Olympus base):
  Olympus(에픽 오케스트라) / Wizard(글래스+미스테리) / Dragon(로어+금속) /
  Cosmic(저주파 신비) / Neon Tokyo(사이버펑크 글리치) / Pirate(바다+캐논) /
  Pharaoh(이집트+모래) / Sakura(일본 전통+koto).

### 5-3. 에셋 생성 파이프라인 (ElevenLabs SFX/Music)
- 엣지 `generate-slot-sfx`(admin only):
  슬롯 테마별 prompt 매트릭스를 받아 ElevenLabs `/v1/sound-generation` + `/v1/music`
  호출 → MP3를 Supabase Storage `slot-sfx/{theme}/{cue}.mp3`로 업로드 → 공개 URL을
  새 테이블 `slot_sound_assets(theme, cue, url, version)`에 upsert.
- prompt 템플릿은 `supabase/functions/generate-slot-sfx/prompts.ts`로 분리
  (예: cosmic.bgm = "deep cinematic space ambient, sub-bass drones, ethereal pads, 30s loop ready").
- 1회성 빌드 작업: admin이 `/admin/slot-sfx`에서 "Generate all" 클릭 → 진행률 + 미리듣기 + 재생성.
- 캐시: 클라는 Howler `preload` + `localStorage` 버전 비교(기존 자산 재다운로드 방지).
- `ELEVENLABS_API_KEY`가 시크릿에 없으면 STAGE 5만 일시 중단, 프롬프트 후 재개.

### 5-4. 기존 절차 사운드 폴백
- 자산 미존재(생성 전) 또는 로딩 실패 시 자동으로 기존 `slotSound.ts` Web Audio 합성으로 폴백
  → 게임 진행 차단 없음. 폴백 발동은 STAGE 4 `sound_init_failed`로 적재.

### 5-5. 메커닉별 SFX 큐 매핑 (요청 ⑦)
| 오버레이 | mech cues |
|---|---|
| StickyMulti | `sticky_lock`, `multi_tick`, `respin_start` |
| Hold88 | `coin_drop`, `coin_lock`, `respin_reset`, `grid_full` |
| CrashCannon | `crash_tick`(가속 pitch up), `crash_boom`, `cannon_load` |
| PickReveal | `card_flip`, `prize_reveal`, `bomb_fail`, `jackpot_chime` |
| ThreePath | `path_choose`, `path_walk`, `realm_arrive` |
| ClusterTumble | `tumble_cascade`, `multi_step_up`, `cluster_pop` |
| MissionTrail | `trail_step`, `checkpoint`, `mission_clear` |

---

## STAGE 6 — 모바일 60fps + 제스처 안정화
- `Reel.tsx` `transform: translate3d` + `will-change: transform` 명시, layout thrash 제거.
- framer-motion: 비-핵심 연출 `tween`로 통일, spring은 보스/Big Win 1회만.
- 베팅 슬라이더: `pointerType==='touch'` 시 햅틱 + tap 영역 ≥44px, 휠 회전 IndexSlider.
- `prefers-reduced-motion: reduce` 분기(셰이크/펄스 제거, 시네마틱 1회 페이드).
- `browser--start_profiling` → 카지노 로비 + Cosmic Forge 1게임 → `stop_profiling`,
  self-time 상위 3개 함수 fix. 결과 표로 보고.
- BalanceTicker 등 `setInterval` → `requestAnimationFrame`.

---

## STAGE 7 — Stake-style Live Win-Feed + 리더보드
- 신규 테이블 `slot_win_feed(user_id, game_code, bet, payout, mult, created_at)`
  RLS: 모두 SELECT, 본인만 INSERT(서버 트리거가 대신 INSERT).
- spin 트리거: `payout/bet ≥ 50` 시 자동 insert + `pg_notify('slot_feed', ...)`.
- RPC: `get_slot_top_wins_24h(_limit)` (mult DESC),
  `get_slot_top_players_24h()` (sum payout DESC).
- UI:
  - `<SlotWinFeed />` — 카지노 로비 사이드 마키, supabase realtime 구독(unified channel).
  - `<SlotLeaderboard />` — 탭 3개: 24h Mult / 24h Volume / 24h Bonus Hits.
- 어뷰즈 가드: 동일 user 분당 ≥6회 50× 적중 시 `anomaly_events` 'slot_win_burst'.

---

## 진행 규칙
- 각 STAGE 완료 직후 결과 보고 → "다음" 시 다음 STAGE 진입.
- 마이그레이션은 STAGE 1 / 4 / 5 / 7에서만, 각각 별도 승인.
- STAGE 5는 `ELEVENLABS_API_KEY` 확인 후 진행. 미설정 시 STAGE 5 첫 단계에서 시크릿 요청.
- 시뮬·vitest·프로파일러는 자동 실행, 결과만 보고.
