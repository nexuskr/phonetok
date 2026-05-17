# PHONARA Core v2.0 Final Sign-off

Phase A (Gamification Pass 2) + Phase B (FOMO Engine v2) + Phase C (PhonHub v3) 모두 완료된 상태를 v2.0으로 잠그고, 운영 점검 + 메모리 등재만 수행한다. 신규 기능/UI 변경 없음.

## 실행 항목

1. Kill Switch 상태 점검 (read-only)
   - `platform_kill_switches`에서 `phon_swap`, `phon_staking`, `phon_betting`, `trading_halt`, `withdrawals_halt`, `signup_halt`, `maintenance_mode`, `degrade_mode` 현재 값 확인
   - 비정상(예: phon_* 가 enabled=true 로 차단되어 있음) 발견 시 사용자에게 보고만 하고 변경은 별도 승인 후

2. 무손상 게이트 3종 검증
   - `node scripts/check-money-flow-freeze.mjs`
   - `node scripts/check-operator-isolation.mjs`
   - `npm run size:check`

3. v2.0 메모리 등재
   - 신규 파일 `mem://features/v2.0-core-complete` 작성: Phase A/B/C 핵심 모듈, RPC, 컴포넌트 마운트 위치, 불변 가드(8경로/Operator Isolation/Bundle Budget/Realtime Partition/Active Governor) 요약, 검증 결과
   - `mem://index.md` Memories 섹션에 1줄 링크 추가 (Core 섹션은 미변경)

4. E2E 시나리오 점검 (코드 경로 워크스루 — read-only)
   - 스왑: `swap_phon_krw` → `phon_balances` 갱신 → `useWalletChannel` → PhonHub `SwapBridgeMini`/`phon_hub_summary` 반영
   - 스테이킹/배당: `phon_stakes` insert → 00:10 KST cron → `phon_stake_yields` → `DailyDividendCounter`
   - 트레이딩: `live_positions` open → `trg_enforce_leverage_gate` → 결제 / Crown
   - 업적: observer 트리거 → `achievement_progress` → `AchievementUnlockListener` → confetti
   - FOMO: `LiveTradingCounter` 12s / 친구 격차 토스트 24h 디듀프 / `WhaleStrikeRail`
   - PhonHub: `/phon` → `phon_hub_summary` single RPC + realtime

5. 최종 보고
   - Kill Switch 상태표 + 3개 가드 PASS/FAIL + E2E 체크리스트를 한 화면에 정리

## 기술 메모

- 소스 코드 변경 없음. 신규/수정 파일은 `mem://` 2개와 (필요 시) 보고용 콘솔 출력만.
- DB 마이그레이션 없음. 점검은 `supabase--read_query` 한 번이면 충분.
- Kill Switch 변경, 신규 RPC, 신규 컴포넌트는 본 사인오프 범위 밖 — 별도 Phase D로 분리.
