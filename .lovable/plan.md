# Phase 4 — Mobile OS Exclusive Hyper-Optimization

목표: Phonara.world를 모바일 네이티브앱 체감(LCP ≤ 1.5s / INP ≤ 100ms / CLS ≤ 0.02, 60fps 무한 유지)으로 끌어올린다. Money-flow 8경로, Operator Isolation, imperial_* 함수, 8개 freeze 경로는 **0바이트** 변경.

---

## 불변 가드 (모든 단계 공통)
- Money-flow 8경로 `git diff = 0` — `scripts/check-money-flow-freeze.mjs` PR마다 실행
- Operator chunk Layer 1 0바이트 — `scripts/check-operator-isolation.mjs`
- imperial_* RPC 본문 unchanged — DB migration 금지
- 모든 신규 컴포넌트 `imperial_` prefix, Atomic/Idempotent/Observable/Rollbackable
- Realtime은 `@pkg/realtime` 파티션 래퍼만 사용
- 토스트 `@/lib/notify`만, sonner 직접 호출 금지

---

## Sprint 0 — Diagnosis & Baseline (1 PR, 읽기 전용)

산출물: `reports/mobile-baseline-2026-05-20.md`

1. `lighthouserc.json` 모바일 프리셋(Moto G4 + 4G throttle)으로 6개 핵심 라우트 측정 — `/`, `/home`, `/duel`, `/dashboard`, `/wallet`, `/casino/aztec-sun-1200`
2. `browser--performance_profile` + `start_profiling` 으로 INP 병목 함수 Top 10
3. 번들 분석: `bundle-budget.latest.json` 대비 라우트별 transferred KB 표
4. Stake.com / Rollbit 모바일 5개 화면 (홈 / 게임 로비 / 슬롯 / 베팅 / 지갑) 캡처 비교

Gate: 베이스라인 표 + Top 10 병목 + Stake 비교 표 머지 후 다음 진입.

---

## Sprint 1 — Mobile Shell & Web Vitals 코어 (PR 단위 4개)

1. **PR-Mob1 PWA 매니페스트 강화** (제한적)
   - `public/manifest.webmanifest` `display_override: ["window-controls-overlay","standalone"]`, `categories`, `screenshots[]` (mobile narrow 1, wide 1)
   - iOS splash `<link rel="apple-touch-startup-image">` 4 size
   - Service Worker 변경 **없음** (현행 `registerSW.ts` 가드 유지)

2. **PR-Mob2 LCP 자산 프리로드 + 폰트 swap**
   - `index.html` 모바일 hero 이미지 `<link rel="preload" as="image" fetchpriority="high" media="(max-width: 768px)">`
   - 모든 `@font-face` `font-display: swap` 강제 감사

3. **PR-Mob3 CLS 제거**
   - `<img>` width/height 누락 자동 스캔 스크립트 `scripts/check-img-dimensions.mjs` 추가 + CI
   - Topbar / BottomNav 고정 높이 토큰화 (`--topbar-h`, `--bottom-nav-h`) — 이미 일부 존재, 누락 페이지 보강

4. **PR-Mob4 INP — useTransition 도입**
   - 무거운 클릭 핸들러(베팅 슬립 다이얼 변경, 카지노 spin 트리거 UI 업데이트만) `startTransition` 감싸기 — **RPC 호출/머니플로 코드 본문 무변경**, UI state 갱신만

Gate: Lighthouse Mobile 4지표 ≥ 90, INP 측정값 ≤ 150ms.

---

## Sprint 2 — Cosmetic Compute Offload (Web Worker, 머니플로 무변경)

대상: **시각/사운드 전용** 계산만 (Near-Miss 시각 effect, particle, multiplier 카운트업 보간, AI Fortune 텍스트). **베팅 결과/배당/seed/RNG 결과는 서버 RPC 단일 소스 — Worker로 옮기지 않는다.**

1. `src/packages/workers/imperial_cosmetic_worker.ts` (Dedicated Worker)
2. Comlink는 UI 트리거용만, particle 좌표는 `Float32Array` Transferable
3. SAB는 **도입하지 않음** — COOP/COEP credentialless 가 Supabase OAuth 팝업과 충돌 가능, 도입 시 별도 ADR 필요 (Sprint 후속 검토)
4. Fallback: Worker 미지원/저사양은 메인 스레드 동기 계산 — Graceful degrade

Gate: spin 1회당 main thread long task ≤ 50ms (현재 측정 후 목표 재조정).

---

## Sprint 3 — Mobile Native Feel (UI only)

대상 화면: `/home`, `/duel`, `/wallet`, `/dashboard`, 카지노 슬롯 12종 헤더

1. **Pull-to-Refresh** — `@pkg/ui/mobile/imperial_PullToRefresh.tsx` (touch + framer-motion, 60fps transform-only)
2. **Swipe Gesture** — Duel Lobby Gate 카드 좌우 스와이프로 룸 전환
3. **Haptic** — `navigator.vibrate` 안전 가드 + 사용자 토글 (`localStorage phonara:haptic:v1`)
4. **Skeleton 통일** — 기존 `@/components/ui/loading-state` 강제 사용 감사 (이미 메모 등록됨)
5. **Glass + Dynamic Island top capsule** — `imperial_DynamicCapsule.tsx` PowerHeader 모바일 변형
6. 기존 `MobileOrderSheet`, `BottomSheet`, `FloatingFab` 재사용 — 신규 중복 컴포넌트 만들지 않음

Gate: 실측 60fps 유지(Performance panel scrolling FPS meter), 터치 응답 ≤ 100ms.

---

## Sprint 4 — Image / Bundle 다이어트

1. `vite-imagetools` 도입, hero/카지노 썸네일 AVIF + WebP + srcset 자동 생성
2. 모든 `<img>` → `loading="lazy" decoding="async"` 일괄 (top-fold LCP 1장 제외)
3. Lucide 아이콘 사용처 감사 — barrel import 금지, 개별 import 강제 (eslint rule)
4. `size-limit` 예산 재조정: index 165KB, slots 110KB (현재 180/120)
5. Edge cache `_headers` 재확인 — 이미 PR-M에서 immutable 적용

Gate: `bundle-budget` 신규 예산 PASS, 라우트별 Transferred -30% 이상.

---

## Sprint 5 — Verification & Rollback

1. Lighthouse Mobile CI (lighthouserc) 점수 ≥ 95 for `/home`, ≥ 92 for `/duel`·`/dashboard`
2. BrowserStack 5종 (저사양: Galaxy A14, iPhone SE 2nd / 중급: A54, iPhone 12 / 고급: S24) 60fps + INP 100ms 수동 확인 — 결과 `reports/mobile-device-matrix-YYYY-MM-DD.md`
3. Stake.com vs Phonara 6항목 비교표 (LCP/INP/CLS/터치반응/스크롤FPS/체감점수) — 산출물 머지
4. Rollback: 각 PR은 단일 revert 안전, Worker 도입 PR은 feature flag `imperial_cosmetic_worker_enabled` (kill switch row) 로 OFF 가능
5. 최종 보고서: `reports/phase4-mobile-hyperion-final.md`

---

## 의도적으로 **하지 않는** 것 (리스크 차단)

- SharedArrayBuffer + COOP/COEP credentialless — Supabase OAuth 팝업·iframe preview 깨질 위험. 별도 ADR 후 결정.
- imperial_* / treasury / settle / withdrawal 함수 본문 수정
- 새 Service Worker 캐시 전략 — 현 가드(`registerSW.ts`)가 preview/iframe 완벽 차단 중, 건드리지 않음
- Realtime broadcast 정책 변경 — Phase 5 후속
- Edge Function 신규 추가 — 본 작업 범위 외
- Framer Motion 제거/교체 — `motion` 청크 이미 분리, 전면 교체 ROI 낮음

---

## 기술 부록

- 신규 디렉터리: `src/packages/ui/mobile/`, `src/packages/workers/`
- 신규 CI: `.github/workflows/mobile-vitals.yml` (Lighthouse Mobile gate)
- 신규 스크립트: `scripts/check-img-dimensions.mjs`
- 신규 kill switch: `imperial_cosmetic_worker_enabled` (`platform_kill_switches` row insert만, 정책 RLS 기존 그대로)
- 메모 갱신: `mem://features/phase-4-mobile-hyperion` (Sprint 완료 시)

---

## 추정 일정

| Sprint | 작업량 | 위험도 |
| --- | --- | --- |
| 0 Diagnosis | 0.5d | none (read-only) |
| 1 Vitals | 1.5d | low |
| 2 Worker | 2d | medium (fallback 필수) |
| 3 Native Feel | 2d | low |
| 4 Bundle | 1.5d | low-medium |
| 5 Verify | 1d | none |

총 ~8.5일. 각 Sprint 머지 후 24h 모니터링.
