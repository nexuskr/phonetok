# Slots v3 — 프로덕션 안정화 & RTP 재튜닝 로드맵

요청 10건을 의존성 순서로 6단계 묶음으로 정리. 각 단계가 끝날 때마다 검증 결과를 보고하고
다음 단계로 진행합니다 (한 턴에 전부 진행하면 회귀 추적이 불가능).

---

## 단계 1 — 서버 권위 모델 정리 (RPC 분기 + buy-bonus 가격 결정)
요청 매핑: ⑥ 서버 RPC 분기, ⑨ buy-bonus 가격/플로우

- `supabase/functions/slot-spin/` 또는 `_slot_compute_spin` RPC를
  **게임별 핸들러로 분기**: `cosmic_forge_5000`, `neon_tokyo_88`, `pirates_curse_1500`,
  `pharaohs_vault_2500`, `viking_thunder_4000`, `aztec_sun_1200`, `cherry_sakura_500`.
  각 핸들러는 `src/lib/slots/engine/games.ts` 수학 프로파일을 mirror한 PL/pgSQL 함수를 호출.
- `slot_games` 테이블에 `buy_bonus_cost_mult` 컬럼 추가 (게임별 50× / 80× / 100× / 150× 차등).
- `request_buy_bonus(game_code, bet)` RPC: 서버가 비용·보너스 entry 자체를 결정 (클라가 cost 못 속이게).
- 클라 `slots-rpc.ts`의 `spinReal/spinDemo`에 `buy_bonus_cost` 응답 필드 반영.

검증: `supabase--read_query`로 새 컬럼/함수 시그니처 확인 + curl로 7게임 모두 호출.

---

## 단계 2 — RTP v3 튜닝 + 100만 판 시뮬 검증
요청 매핑: ③ RTP 95~97% 수렴, ④ 100만 판 검증

- `scripts/slot-sim.ts`를 1,000,000 라운드로 상향, `--game=all` 일괄 모드 추가.
- 게임별 `pt()` 스케일·`symbolWeights`·`bonus.*` 파라미터를 binary search 식으로 튜닝.
- 합격 기준: **RTP ∈ [0.955, 0.970], bonus hit ∈ [1/120, 1/250], maxX ≤ DB 캡**.
- 결과 테이블을 `.lovable/sim-report.md`로 출력 (재현 가능 시드 명시).
- 합격된 가중치를 단계 1의 서버 핸들러에 그대로 반영 (드리프트 방지).

검증: `bun scripts/slot-sim.ts --rounds=1000000 --game=all` → 결과 채팅에 표로 보고.

---

## 단계 3 — 보너스 오버레이 ↔ 서버 payout 동기화 강화
요청 매핑: ⑤ 보너스 전용 UI(Tier-2 이미 완료) 마감, ⑩ E2E 동기화 테스트

- 기존 7개 오버레이(StickyMulti/Hold88/CrashCannon/PickReveal/ThreePath/ClusterTumble/MissionTrail)에
  **`onComplete(winAmount)` 시점 = 서버 응답 payout** 일치 보장:
  - `OlympusSlot`이 오버레이 `onComplete`의 winAmount를 받아 잔고 카운트업과 합치도록 리팩터.
  - 시뮬 데이터(splitSum 결과)와 서버 payout 차이 ±1 PHON 이내로 클램프.
- vitest E2E: 각 메커닉별로 mock RPC 응답 → 오버레이 라이프사이클 → onComplete payload 검증.
  파일: `src/components/slots/overlays/__tests__/bonus-sync.test.ts`.

검증: `bunx vitest run src/components/slots/overlays`.

---

## 단계 4 — 사운드팩 메커닉 큐 + 실패 모니터링
요청 매핑: ⑦ 메커닉별 SFX 큐, ② 프로덕션 모니터링

- `src/lib/slotSound.ts`에 cue 추가:
  `sticky_lock`, `coin_drop`, `crash_tick`, `crash_boom`, `card_flip`,
  `path_choose`, `tumble_cascade`, `trail_step`, `checkpoint`.
  각 SoundPack에 매핑 (Web Audio sweep/noise).
- 실패/불일치 모니터링:
  - 새 테이블 `slot_anomaly_log(user_id, game_code, kind, expected_payout, actual_payout, meta jsonb)`.
  - 클라 어댑터: spin 실패 / sound init 실패 / 오버레이 payout 불일치 시 `log_slot_anomaly()` RPC 호출.
  - admin: `/admin/kpi`에 `<SlotAnomalyPanel />` 24h 카운트 + drill-down.
- 사운드 init 실패는 silent fallback (스핀 자체는 막지 않음).

검증: 의도적 mismatch 주입 후 `slot_anomaly_log` row 확인.

---

## 단계 5 — 모바일 60fps + 터치 제스처 안정화
요청 매핑: ① 모바일 스와이프/회전/프레임드랍

- `Reel.tsx` 회전 애니메이션을 `transform: translate3d` + `will-change` 명시, layout thrash 제거.
- 오버레이의 framer-motion `transition`을 `type: "tween"` 기반으로 통일 (spring은 보스 등장 1회로 한정).
- 모바일 베팅 슬라이더: `pointerType === "touch"` 시 햅틱 + tap 영역 44px↑.
- `prefers-reduced-motion: reduce` 분기 — 셰이크/펄스 비활성, 핵심 시네마틱은 1회 페이드로 단축.
- `browser--start_profiling` → 카지노 로비 + 슬롯 1개 → `stop_profiling`으로 자기시간 상위 함수 fix.
- `requestAnimationFrame`로 타이머 누수 차단 (BalanceTicker count-up 등).

검증: 프로파일러 메인스레드 self-time, FCP/LCP, INP — 변경 전후 표로 보고.

---

## 단계 6 — Stake-style live win-feed + 리더보드
요청 매핑: ⑧ 실시간 win-feed/리더보드

- 새 테이블 `slot_win_feed(user_id, game_code, bet, payout, mult, created_at)` (RLS: 모두 SELECT, 본인 INSERT).
- 트리거: spin payout ≥ 50× bet → `slot_win_feed` insert + `pg_notify`.
- 리더보드 RPC: `get_slot_top_wins_24h(_limit)` (mult DESC), `get_slot_top_players_24h()` (sum payout).
- UI: `<SlotWinFeed />` (카지노 로비 사이드 마키, supabase realtime 구독),
  `<SlotLeaderboard />` (탭: 24h Mult / 24h Volume / Bonus Hits).
- 어뷰즈 가드: 동일 user_id 분당 6회 이상 ≥50× 적중 시 `anomaly_events` 'slot_win_burst' 적재.

검증: 두 브라우저 세션에서 한쪽 spin → 다른쪽 피드 ≤2s 내 표출.

---

## 진행 방식
- 각 단계 끝나면 결과 보고 → "다음" 응답 시 다음 단계 진행.
- 중간에 우선순위 바꾸고 싶으시면 단계 번호로 지시 (예: "단계 2부터").
- DB 마이그레이션은 단계 1·4·6에서만 발생 (각각 별도 승인 받음).
- 시뮬 / vitest는 토론 없이 자동 실행, 결과만 보고.
