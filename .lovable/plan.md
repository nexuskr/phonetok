# PHONARA Ω v3.1 — DETOX MIGRATION PLAN (9 Phases, LOCKED Order)

> **Mode shift:** 기능 개발이 아니라 **기존 시스템을 새 OS 규칙으로 강제 이주**시키는 단계.
> 속도가 아니라 **누수 차단 + 구조 고정 + Layer 1 생존성**이 목표.
>
> **Detox 끝날 때까지 순서 고정:** 삭제 > 분리 > 격리 > 측정 > 최적화.
> **신규 기능 금지 (FREEZE 유지).**
>
> **PHON FREEZE (절대):** PHON 토큰 시스템 · 토크노믹스 · 컨트랙트 · balance/routing/utility ·
> staking/claim · token DB schema · PHON API signature 는 **이번 Detox 범위에서 완전 제외**.
> Critical money path 의 PHON 로직은 **read-only handling** 원칙. "성능은 바꿔도 의미는 바꾸지 않는다."
> PHON 시스템 = **legacy-core financial layer** → refactor 대상이 아니라 **isolation + stabilization** 대상.

---

## Phase 진행 원칙

```text
PHASE 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
순서 절대 고정. 이전 phase exit criteria 충족 전 다음 phase 진입 금지.
각 phase 시작 시 baseline metric snapshot → 종료 시 diff 첨부.
```

---

## PHASE 1 — OLD ARCHITECTURE 봉쇄 (가장 먼저)

새 구조 추가 전에 **옛 구조가 다시 들어오는 것 자체를 물리적으로 차단**.

**산출물**
- ESLint custom rules:
  - `eslint/no-direct-sonner` — `toast(...)` direct import reject. `@/lib/notify` 만 허용.
  - `eslint/no-raw-channel` — `supabase.channel(...)` direct call reject. `@pkg/realtime/*` wrapper 만 허용.
  - `eslint/no-cross-layer-import` — Layer1 → Layer2/3 import reject. critical → optional import reject.
  - `eslint/animation-budget` — 한 화면 motion 컴포넌트 > 3 reject.
- `dependency-cruiser` config — 폴더 경계 강제 (critical / optional / operator).
- `.github/workflows/perf-gate.yml` CI 연결 — lint + bundle + lighthouse 강제.

**Exit:** main 브랜치에서 위반 0건. PR 차단 동작 검증.

---

## PHASE 2 — RUNTIME DETOX (현재 렉/메모리/배터리 원인 제거)

`setInterval` 30+ 전수 제거. 전부 `setVisibleInterval` / `runWhenIdle` / `runAfterFirstInteraction` 로 강제 이전.

**우선 대상:** lounge · dashboard · live ticker · whale feed · polling hooks.

**목표 (측정 가능):**
- background RPC -70%
- idle CPU 급감 (DevTools performance 캡처 첨부)
- Android 발열 감소 (체감 + thermal API)

**Exit:** `grep -r "setInterval(" src/` 결과 = 화이트리스트 등록된 항목만 잔존.

---

## PHASE 3 — GIANT COMPONENT SURGERY (가장 위험)

**대상:** Dashboard / Lounge / Cockpit (그 외 500 LOC 초과 컴포넌트 전수).

**규칙**
- 1 component ≤ 500 LOC
- fetch / render / realtime / animation / state **분리**
- selector 기반 구독
- `React.memo` 기본화

**분리 구조**
```text
features/<name>/
  view/        # 순수 렌더
  hooks/       # data fetching
  stores/      # zustand slice
  realtime/    # WS subscription
  widgets/     # 작은 view 조각
```

**목표는 "쪼개기"가 아니라 `re-render blast radius 최소화`.**

**Exit:** 대상 컴포넌트 React Profiler에서 wallet/balance 갱신 시 rerender count 80% 감소.

---

## PHASE 4 — REALTIME ISOLATION (돈 흐름 보호)

wallet / game / chat / market **독립 heartbeat**.

**규칙**
- chat 죽어도 wallet 영향 0
- feed reconnect loop → deposit 절대 미영향
- optional WS reconnect 는 critical runtime 과 완전 분리

**추가**
- WS health telemetry (`@pkg/telemetry/ws`)
- reconnect/min 추적
- `SYSTEM_DEGRADE` auto-trigger 연결 (reconnect > 3/min)

**Exit:** chat 채널 강제 kill 시 wallet/deposit/withdraw 정상 동작 검증 (수동 + e2e).

---

## PHASE 5 — LAYER 1 DIET (모바일 survival)

**Layer1 첫 paint 180KB gzip 전쟁.**

**즉시 제거 대상**
- framer-motion 남용 (Layer1 에서 import 금지, Layer2+ only)
- heavy chart (lightweight-charts 만 허용, recharts Layer1 추방)
- giant icon packs (lucide tree-shake 강제)
- eager avatar preload
- hidden tab fetch
- autoplay / video preload

**필수 적용**
- route-level lazy (`React.lazy` + `Suspense`)
- component-level lazy
- list virtualization (`@tanstack/react-virtual`)
- skeleton only (CLS 0)
- thumb-zone redesign (BottomNav 48dp)

**목표 (360px Android low-end)**
- LCP < 2.5s
- INP < 200ms
- 60fps 유지

**Exit:** lighthouse mobile ≥ 90, bundle-check Layer1 gzip ≤ 180KB.

---

## PHASE 6 — GLOBAL STATE DETOX

`useDB` mega-context **해체**.

**전략:** global mega-context → domain zustand stores.

```text
walletStore   (PHON 읽기 전용 미러 포함 — PHON 의미/계산 변경 금지)
liveStore
chatStore
marketStore
```

selector 구독 강제. 전체 rerender 제거.

**PHON 가드:** wallet store 는 PHON balance/routing 결과를 **그대로 노출만** 함. 파생 계산·합산·환산 추가 금지.

**Exit:** `useDB` import 0건. wallet 갱신 시 chat/live/market 컴포넌트 rerender 0.

---

## PHASE 7 — FAIL-SOFT COMPLETION

optional mount 전부 `SoftBoundary` 로 감싸기.

**대상:** clips · chat · avatar · social · prediction · 3d · feed.

**절대 규칙:** optional throw → critical 영향 0.

**실패 UX:** 빨간 에러 화면 ❌ → 조용한 fallback card + auto retry ✅.

**Exit:** 각 optional 모듈에 강제 throw 주입 → critical path (login/wallet/play) 무영향 확인.

---

## PHASE 8 — OPERATOR EXTRACTION

admin/operator **완전 분리**.

**제거 대상 (user bundle 안에서):** moderation · kernel tools · payout tools · KPI dashboard · security panel.

**최종 구조**
```text
apps/web        # 일반 사용자
apps/operator   # admin / moderation / kernel
apps/studio     # 콘텐츠 / 라이브
```
별도 build · 별도 deploy · 별도 auth · 별도 WS namespace.

**Exit:** `apps/web` bundle 에 `@pkg/operator/*` import 0건. operator route 접근 시 별도 chunk fetch 확인.

---

## PHASE 9 — HARD PERFORMANCE GOVERNANCE (문화 고정)

이 시점부터 **모든 PR**:
- Which 2+ core laws?
- Budget Impact (bundle diff / RPC diff / INP 영향)
없으면 reject.

PR 템플릿 + CI bot 자동 코멘트 (bundle diff, lighthouse diff, rerender diff).

**목표:** "개발 속도"보다 "무게 증가 방지"를 **조직 문화로 고정**.

---

## PHON FREEZE — 절대 금지 / 허용 범위

**절대 금지 (전 phase 공통)**
- PHON 토큰 구조 변경
- 토크노믹스 수정
- 컨트랙트 수정
- balance logic 변경
- token-linked reward flow 변경
- staking / claim 구조 수정
- token DB schema 변경
- PHON 관련 API signature 변경

**허용 범위 (성능/구조 한정)**
- lazy loading
- render optimization
- rerender 감소
- polling 최적화
- virtualization
- import boundary 분리
- optional isolation
- bundle reduction

**규칙:** "성능은 바꿔도 의미는 바꾸지 않는다." critical money path 의 PHON 로직 = **read-only handling**.

---

## 진짜 적 (잊지 말 것)

```text
렉 · 피로 · 재렌더 폭발 · giant state · import 오염
optional → critical 전염 · 모바일 발열 · attention 과잉 · 구조 비대화
```

목표: "더 화려한 플랫폼"이 아니라 **"10배 커져도 안 죽는 구조로 재탄생"**.

---

## 기술 세부 (PM 요약용이 아닌 엔지니어용)

- ESLint plugin: 로컬 `eslint-plugin-phonara/` 디렉터리 + `eslint.config.js` 등록.
- dependency-cruiser: `.dependency-cruiser.cjs` 에 layer / critical / optional / operator 경계 정의.
- perf-gate CI: `scripts/bundle-check.ts` (size-limit), `lighthouserc.json` (mobile preset, perf ≥ 90).
- runtime helpers: `@pkg/performance/runtime.ts` (이미 존재) 의 `runWhenIdle` / `runIfVisible` / `runAfterFirstInteraction` + 신규 `setVisibleInterval`.
- realtime: `@pkg/realtime/*` 4-partition wrapper (이미 존재). raw `supabase.channel` 호출은 lint reject.
- store: zustand slice per domain, `subscribeWithSelector` 강제, `shallow` compare 기본.
- SoftBoundary: `@pkg/ui/SoftBoundary` (이미 존재) — telemetry hook `softFail()` 자동 발사.
- operator split: 단기엔 `src/packages/operator/` 격리 + Vite manualChunks 로 분리, 장기엔 별도 app.

---

## 진행 트래킹

각 phase 별:
1. Baseline snapshot (bundle / lighthouse / RPC count / rerender count)
2. 작업
3. Exit metric diff
4. 다음 phase 진입 승인

본 plan 은 phase 1 부터 순차 시작. 첫 PR = **PHASE 1 ESLint lockdown + dependency-cruiser + perf-gate CI**.
