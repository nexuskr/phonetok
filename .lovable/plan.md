# Imperial Empire Phase 4 — Limited Rollout Production Launch (v20.4)

Phase 3.5 Hardening이 완료된 상태에서 실제 PHON이 흐르는 Limited Rollout을 안전하게 점화한다. Money-flow 8경로 git diff = 0, Operator Isolation, 모든 신규 객체 `imperial_` prefix를 절대 원칙으로 유지한다.

---

## 1. Full Stack Integration Test (Deadlock + PID + Hybrid SCC + Rollout Gate)

신규 통합 시나리오를 단일 진입점에서 실행한다. Money-flow 함수는 호출만 하고 본문은 건드리지 않는다.

- `src/__tests__/integration/imperial-fullstack.integration.test.ts`
  - 300 동시 가상 사용자 시나리오 (place → settle → burn → rollback drill)
  - Hybrid SCC + Tarjan 사이클 검출, PID setpoint 추종 검증
  - Rollout Gate Tier 0/1/2/3 daily cap 경계 테스트
- `scripts/chaos/imperial-fullstack-drill.ts`
  - kill switch 강제 ON → 모든 placement reject 확인 → unfreeze 후 회복 시간 측정
- 결과 리포트: `reports/imperial.fullstack.integration.<date>.json`

QA: Money-flow git diff = 0 / Operator Isolation PASS / Tarjan O(V+E) 검증 / PID 정착시간 < 5s.

---

## 2. Production Hardening Final Layer

### 2.1 Circuit Breaker v2
- `src/lib/imperialCircuitV2.ts` — 3-state (Closed / Open / Half-Open), exponential backoff, jitter, per-RPC budget.
- 기존 `src/lib/rpc-circuit.ts` 는 deprecated re-export로 호환 유지.

### 2.2 Global Observability
- 신규 테이블 `imperial_observability_events` (append-only, admin-only RLS)
- RPC `imperial_log_observability(_kind text, _payload jsonb)` — idempotency key (kind, dedupe_key, hour bucket)
- 신규 컴포넌트 `src/components/admin/ImperialObservabilityStream.tsx` (15s 자동 갱신, severity 필터)

### 2.3 Auto-Healing
- 신규 cron `imperial_auto_heal_tick()` — 매 5분
  - stuck reserved intents → reclaim (기존 `reclaim_stale_intents` 위임)
  - 이상 emission scale (|s-1| > 0.5 지속 30분) → 자동 emission kill switch ON + alert
  - 비정상 burn 0 (last 1h) + injection > 0 → alert only
- 신규 RPC `imperial_get_auto_heal_log(_hours int)`

---

## 3. Limited Rollout Activation Sequence

### 3.1 Surgical Enablement
- 신규 RPC `imperial_rollout_activate(_phase int, _actor uuid)` (AAL2, audit log)
  - phase 1: kill switches 유지 OFF, Tier 0 only, observer mode 24h
  - phase 2: Tier 1 활성, daily cap 50k PHON
  - phase 3: Tier 2 활성, cap 250k
  - phase 4: Tier 3 무제한 + 모든 게이트 GREEN
- 신규 테이블 `imperial_rollout_phases` (phase, started_at, started_by, metrics_snapshot jsonb, status)

### 3.2 Money-Flow Freeze 확인
- `scripts/check-money-flow-freeze.mjs` 자동 실행 in CI step
- 본 Phase에서 8개 핵심 파일 git diff = 0 명시 보고

---

## 4. Ultimate Admin Command Center

- 신규 페이지 `src/pages/admin/imperial/CommandCenter.tsx` (Operator 청크, AAL2)
  - 5 패널: Rollout Phase, Auto-Heal Log, Observability Stream, Circuit Breaker States, Kill Switch Matrix
  - 15s 자동 갱신 + WebSocket realtime (useGameChannel `imperial:command`)
- `/admin/imperial` 라우트 추가, `_AdminSidebar` 항목 추가
- Operator manualChunks 패턴 일치 확인 (`check-operator-isolation.mjs`)

---

## 5. Comprehensive Load Test

- `scripts/load/imperial-300k-locks.ts` — 300k 분산 잠금 시뮬레이션 (in-memory wait-for graph, Tarjan)
- `scripts/load/imperial-pid-autotune-cycle.ts` — Relay Feedback + Ziegler-Nichols open loop 자동 튜닝 1회 full cycle 측정
- 결과: `reports/imperial.loadtest.<date>.json`
  - p50/p95/p99 lock acquire, deadlock 검출률, PID 정착 시간

---

## 6. Final Go/No-Go Package + Eternal Archive

- `docs/duel/phase4-production-launch-bible.md`
  - 전체 스택 다이어그램, Rollout 시나리오, Rollback playbook, On-call runbook
- `docs/duel/phase4-go-nogo-checklist.md`
  - 18-item GO/NO-GO 체크리스트 (Money-flow diff / SCC / PID / Burn / NFT / Rollout / Observability 등)
- `mem://features/phase-4-limited-rollout` 신규 메모 + `mem://index.md` Core 한 줄 추가

---

## Technical Details

### 신규 SQL Migration (단일 파일)
`supabase/migrations/<ts>_imperial_phase4_rollout.sql`
- `imperial_observability_events` 테이블 + RLS (admin SELECT, SECURITY DEFINER INSERT)
- `imperial_rollout_phases` 테이블 + RLS
- `imperial_auto_heal_log` 테이블 + RLS
- 함수: `imperial_log_observability`, `imperial_rollout_activate`, `imperial_auto_heal_tick`, `imperial_get_auto_heal_log`
- pg_cron: `imperial_auto_heal_tick` every 5 min

### 신규 파일
- `src/lib/imperialCircuitV2.ts`
- `src/components/admin/ImperialObservabilityStream.tsx`
- `src/components/admin/ImperialRolloutPhasePanel.tsx`
- `src/components/admin/ImperialAutoHealPanel.tsx`
- `src/pages/admin/imperial/CommandCenter.tsx`
- `src/__tests__/integration/imperial-fullstack.integration.test.ts`
- `scripts/chaos/imperial-fullstack-drill.ts`
- `scripts/load/imperial-300k-locks.ts`
- `scripts/load/imperial-pid-autotune-cycle.ts`
- `docs/duel/phase4-production-launch-bible.md`
- `docs/duel/phase4-go-nogo-checklist.md`

### 편집 파일 (money-flow 무관)
- `src/pages/admin/_AdminSidebar.tsx` — Imperial Command Center 링크
- `src/pages/admin/_nav.ts` — 신규 라우트 등록
- `vite.config.ts` — Operator manualChunks 패턴이 이미 `src/pages/admin/**` 를 잡으므로 변경 없음 확인
- `mem://index.md`, `mem://features/phase-4-limited-rollout`

### 절대 건드리지 않는 8경로 (FREEZE)
`useDeposit.ts`, `useDepositRealtime.ts`, `useDepositCountdown.ts`, `bybit-feed.ts`, `useCrashRound.ts`, `MegaOrderPanel.tsx`, `use-kill-switches.ts`, `use-auto-bet.ts`, 그리고 `imperial_place_phon_bet` / `settle_phon_bet` / `_apply_house_edge_split` SQL 본문.

### Rollout 점화 시퀀스 (실 운영)
```text
Phase 1 (T+0h)   observer, Tier 0, all kill OFF default
Phase 2 (T+24h)  Tier 1 ON, cap 50k, burn ON
Phase 3 (T+72h)  Tier 2 ON, cap 250k, NFT mint ON
Phase 4 (T+168h) Tier 3 ON, unlimited, full GREEN
```
각 phase 진입 전 18-item GO/NO-GO 체크리스트 PASS 필수.

---

## Verification Gates (모든 단계 종료 시)
1. `check-money-flow-freeze.mjs` PASS
2. `check-operator-isolation.mjs` PASS
3. `imperial_get_kernel_summary()` 정상
4. `admin_get_flywheel_health(24)` Net Deflation ≥ 0
5. Integration test green
6. Load test p99 lock acquire < 50ms
7. Rollback drill 1회 성공 기록
