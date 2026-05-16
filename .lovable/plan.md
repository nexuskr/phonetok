# Phase 2 — VISIBILITY ONLY (Execution Contract Locked)

> Contract: We do NOT refactor. We expose reality.
> No interval migrated. No RPC removed. No behavior changed.
> Coverage is a **visibility** metric, never an optimization metric.

Phase 1 (lockdown) 완료. Phase 2 본작업(Runtime Detox migration)은 **다음 PR**. 본 PR은 그 전 단계 — runtime 의 모든 entropy 를 측정 가능한 표면(surface)으로 끌어올리는 instrumentation-only 작업이다.

## 0. 절대 규칙

| 금지 | 허용 |
|---|---|
| 기존 `setInterval` 호출 1줄도 수정 금지 | 새 ledger / registry 파일 추가 |
| 비즈니스 로직 / RPC 흐름 변경 금지 | DEV-only override 로 raw 실행 캡처 |
| 성능 최적화 · throttle · block 금지 | snapshot · coverage 계산 · telemetry emit |
| 삭제 · cleanup · refactor 금지 | 분류 (tracked / untracked / entropy) |

production 번들에 코드 한 줄도 추가되지 않는 것이 성공 기준.

## 1. 파일 레이아웃 (네이밍 계약)

```text
src/packages/runtime/
  runtime.registry.ts     # tracked + untracked dual ledger
  runtime.observe.ts      # window.setInterval / clearInterval override (DEV)
  runtime.governor.ts     # killCategory / killAll — Phase 2 본작업이 사용 (이 PR에선 스텁만)
  runtime.lattice.ts      # 카테고리·owner 매핑 헬퍼

src/packages/entropy/
  entropy.surface.ts      # 현재 살아있는 runtime footprint snapshot
  entropy.capture.ts      # window.setInterval 캡처 진입점 (dev bootstrap)
  entropy.map.ts          # category 추론 (stack → owner → category)

src/packages/risk/
  risk.reactor.ts         # (스텁) Phase 4 SYSTEM_DEGRADE 진입점
  risk.kill-switch.ts     # (스텁) governor 위임
  risk.degrade.ts         # (스텁) cosmetic kill 카탈로그

scripts/
  rpc.surface.baseline.mjs   # foreground/hidden/idle 3-mode RPC ledger

reports/
  rpc.surface.2026-05-16.json
  entropy.surface.2026-05-16.json
```

기존 `src/lib/util/visible-interval.ts` 는 **이동하지 않는다**. 내부에서 `runtime.registry` 만 import 해 등록만 추가. 호출처는 손대지 않음.

## 2. Dual Ledger 모델

`runtime.registry.ts` 의 정의:

```ts
type LedgerEntry = {
  owner: string;          // 컴포넌트/훅/모듈 추정값
  intervalMs: number;
  category:
    | "money_flow"        // wallet/trading/oracle/kill-switch
    | "cosmetic"          // ticker/marquee/countdown
    | "admin"             // operator panels
    | "unknown";          // ← 분류 실패 = entropy
  createdAt: number;
  stack?: string;         // DEV only
};

const tracked   = new Map<number, LedgerEntry>();  // 의도된 실행
const untracked = new Map<number, LedgerEntry>();  // entropy (legacy)
```

**규칙 (절대):**
- 명시적 `trackInterval(id, meta)` 호출이 없으면 → 자동으로 `untracked` 로 분류
- `untracked` 항목은 **safe 로 가정하지 않는다** — 단지 visible 할 뿐
- `category: "unknown"` 은 DEV 콘솔에 `console.warn("[entropy] uncategorized", entry)` 1회

API:
- `trackInterval(id, meta)` / `markUntracked(id, meta)`
- `forgetInterval(id)` — clearInterval 래퍼가 호출
- `snapshot()` → `{ tracked: LedgerEntry[], untracked: LedgerEntry[] }`
- `coverage()` → `tracked.size / max(1, tracked.size + untracked.size)`
- `killCategory(cat)` — 스텁 only (Phase 4 reactor 가 사용)

**Coverage 해석표** (visibility 지표, optimization 지표 아님):

| coverage | 의미 |
|---|---|
| < 0.3 | entropy dominant — 시스템이 자기 자신을 모름 |
| 0.3–0.7 | mixed state |
| ≥ 0.7 | controllable system |
| 1.0 | fully instrumented runtime |

## 3. Zero-intrusion Override (가장 중요)

`runtime.observe.ts` — App boot 시 side-effect import 1회. **DEV 전용**, prod 빌드에선 빈 모듈로 분기.

```ts
// runtime.observe.dev.ts
if (typeof window !== "undefined") {
  const native = window.setInterval.bind(window);
  const nativeClear = window.clearInterval.bind(window);

  window.setInterval = function (fn: any, delay?: number, ...args: any[]) {
    const id = native(fn, delay, ...args);
    if (!tracked.has(id)) {
      markUntracked(id, {
        owner: "legacy",
        intervalMs: Number(delay ?? 0),
        category: inferCategoryFromStack(new Error().stack), // unknown 기본
        createdAt: Date.now(),
        stack: new Error().stack,
      });
    }
    return id;
  } as typeof window.setInterval;

  window.clearInterval = function (id?: number) {
    if (typeof id === "number") forgetInterval(id);
    return nativeClear(id as any);
  } as typeof window.clearInterval;
}
```

**Stateless guarantee:**
- native 호출 후 등록 (timing 변경 0)
- 인자 변형 없음, throttle 없음, block 없음
- production 진입 경로: `runtime.observe.prod.ts` = no-op export

부트 위치: `src/App.tsx` 의 idle 블록에 `import "@pkg/runtime/runtime.observe"` 1줄. Vite 가 `import.meta.env.DEV` 분기로 prod 트리쉐이크.

## 4. setVisibleInterval — registry 등록만 추가

기존 `src/lib/util/visible-interval.ts` 시그니처 호환 유지. 옵션에 `meta` 추가:

```ts
setVisibleInterval(fn, ms, {
  leading, catchUpOnVisible,
  meta?: { owner, category }   // 신규, 선택
});
```

내부에서 DEV 일 때만 `trackInterval(id, { owner, intervalMs: ms, category, ... })`. 기존 호출처는 손대지 않음 — 등록이 없으면 자동으로 untracked 로 떨어지므로 ledger 무결성 유지.

## 5. RPC Surface — Foreground / Hidden / Idle 3-Mode

`scripts/rpc.surface.baseline.mjs` — 브라우저 콘솔에 붙여 넣는 collector (Playwright 추가 안 함). 동일 collector 를 Phase 2 본작업 종료 후에도 재실행.

```ts
const surface = {
  foreground: { count: 0, byRpc: {} },
  hidden:     { count: 0, byRpc: {} },
  idle:       { count: 0, byRpc: {} },
};

let mode: "foreground" | "hidden" | "idle" = "foreground";
let lastInteraction = Date.now();
const IDLE_MS = 60_000;

document.addEventListener("visibilitychange", () => {
  mode = document.hidden ? "hidden" : "foreground";
});
["pointerdown","keydown","scroll","touchstart"].forEach(ev =>
  window.addEventListener(ev, () => { lastInteraction = Date.now(); }, { passive: true }));

setInterval(() => {
  if (!document.hidden && Date.now() - lastInteraction > IDLE_MS) mode = "idle";
}, 1000);

// fetch + XHR 패치 → /rest/v1/rpc/<name> 분리 카운트
```

시나리오 (5+5+5 분):
1. 로그인 → /dashboard active 5min
2. 백그라운드 5min
3. 복귀 후 idle 5min (입력 없이 방치)

출력 → `reports/rpc.surface.2026-05-16.json`. 추가로 entropy ledger snapshot → `reports/entropy.surface.2026-05-16.json` 함께 커밋.

## 6. Dev Chip (visibility surface)

`import.meta.env.DEV` 일 때만 우측 하단:

```
RUNTIME tracked 0 / entropy 78 · cov 0%
```

클릭 시 테이블 — owner / category / intervalMs / stack. 카테고리별 그룹. production tree-shake.

## 7. Telemetry (visibility emit)

5분에 1회 `telemetry.event("runtime.surface", { tracked, untracked, coverage, byCategory })`. 8% 샘플링 규칙은 우회 — surface 이벤트는 100% (낮은 빈도이므로 비용 없음).

## 8. Failure Modes (PR 차단 조건)

본 PR 은 **다음 중 하나라도 발생하면 실패**:

- `untracked.size === 0` after dev boot → override 가 안 걸린 것 (instrumentation 실패)
- `tracked.size > 0` 인데 호출처 코드는 안 바뀜 → ledger 오작동
- baseline JSON 의 `hidden.count === 0` → visibility 측정 실패
- production 번들 size delta > +1KB → zero-intrusion 위반
- 기존 `setInterval` 호출처 git diff 가 0줄이 아님 → behavior change 의심

## 9. Exit 조건

- [ ] `@pkg/runtime/*` + `@pkg/entropy/*` + `@pkg/risk/*` 파일 생성 (risk 는 스텁)
- [ ] `runtime.observe.dev.ts` 가 부트 후 78개 legacy interval 캡처
- [ ] dev chip 표시 + 클릭 시 테이블
- [ ] `setVisibleInterval` 가 DEV 에서 자동 `trackInterval` 호출
- [ ] `reports/entropy.surface.2026-05-16.json` 커밋 — `untracked > 0`
- [ ] `reports/rpc.surface.2026-05-16.json` 커밋 — 3-mode 모두 측정값 있음
- [ ] Money-flow FREEZE 인벤토리 = ESLint 보호 경로와 일치 (CI 검증 스크립트 1개)
- [ ] PR 템플릿에 "entropy untracked count / coverage / baseline json" 3줄 추가
- [ ] 기존 `setInterval` 호출 git diff: **0줄**

## 10. 비-목표 (이 PR 에서 절대 하지 않음)

- 기존 interval 을 `setVisibleInterval` 로 이주 → Phase 2 본작업
- Money-flow interval 손대기 → PHON FREEZE 영구
- Optimization · throttle · debounce → Phase 5
- governor 의 killCategory 실제 호출 → Phase 4 SYSTEM_DEGRADE
- Operator interval 처리 → Phase 8

## 부록 — Money-flow FREEZE 인벤토리

| 위치 | 주기 | 분류 |
|---|---|---|
| `packages/wallet/hooks/useDeposit.ts:173` | 30s | money_flow |
| `packages/wallet/hooks/useDepositRealtime.ts:69` | — | money_flow |
| `packages/wallet/hooks/useDepositCountdown.ts:22` | 1s | money_flow |
| `lib/paper-trading/bybit-feed.ts:234/238/376` | ping/pong/5s | money_flow |
| `components/crash/hooks/useCrashRound.ts:21` | 1.5s | money_flow |
| `components/trading/MegaOrderPanel.tsx:81` | — | money_flow |
| `hooks/use-kill-switches.ts:71` | 60s | money_flow |
| `hooks/use-auto-bet.ts:26` | 3.5s | money_flow |

이 목록은 `entropy.map.ts` 의 owner-prefix 매칭으로 자동으로 `category: "money_flow"` 분류된다. 분류만 한다 — 절대 수정하지 않는다.

## 한 줄

> Phase 2 PR의 가치는 "얼마나 줄였는가" 가 아니라 "얼마나 visible 해졌는가" 다.
