# PHON 경제 Pass 2 — 머니플로 해제 PR 설계 (DRAFT)

> 본 문서는 별도 PR. 머니플로 8경로 동결 해제 + linter + audit 전수 통과 후 머지.

## 1) swap_phon_krw(direction, amount)

- SECURITY DEFINER + AAL2 강제 + idempotency_keys 입력 필수
- direction ∈ {'krw_to_phon','phon_to_krw'}; 환율 = displayCurrency.ts 미러 + oracle clamp
- 일일 한도(테이블 `swap_limits_daily`) + per-user lock(FOR UPDATE)
- audit: `swap_audit(user_id, direction, in_amount, out_amount, rate, idem_key, anomaly)`
- 실패시 `anomaly_events(rule='swap_limit_exceeded'|'rate_clamp')`

## 2) PHON 스테이킹

- `phon_stakes(id, user_id, amount, started_at, unstaked_at, last_yield_at)` — INSERT는 본인, SELECT 본인, 변경은 RPC만
- `stake_phon(amount)` / `unstake_phon(stake_id)` — phon_balances 차감/환원 trigger 가드
- cron `00:10 KST daily` `settle_phon_staking_daily()` — APY는 `staking_policies` 테이블에서 조회(고정 X, 운영가능)
- 일배당 = `floor(amount * apy / 365)`, 멱등키 = `date || stake_id`

## 3) 베팅 통화 = PHON 분기

- `live_positions.bet_currency text default 'krw'` 추가 (NOT NULL 마이그레이션 X — 기존 행 보호)
- `MegaOrderPanel` 진입 시 사용자 선택 → RPC 인자로 전달 (frozen 파일 변경 필요 → freeze 임시 해제 PR 단독)
- 정산 RPC: `bet_currency='phon'`이면 house_edge × (1 - HOUSE_EDGE_DISCOUNT_RATE)
- 검증: shadow A/B 14일, drift < 5bps

## 4) leverage_gate 강화

- 현재 트리거는 phon≥5000 → 100x. 추가 2x는 보안상 거부 권고 (청산 리스크 ×2 = 시스템 손실 ×2)
- 대안: VIP Pass 활성 시 next tier 임계 -20% (5000→4000 PHON으로 100x 달성)

## 5) Rollout

T0 swap → T+7 staking → T+14 bet_currency shadow → T+28 활성화. 각 단계 kill switch 별도.
