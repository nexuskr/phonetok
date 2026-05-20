# P1-C Final — Layout Hotfix + Hero 재설계 + Strict Crown 0

## 변경 범위 (최소 침습, 머니플로 8경로 git diff = 0)

### 1. Layout Hotfix (사이드바 깜빡임 0)
- `src/components/nav/StakeStyleSidebar.tsx`
  - `useEffect` → `useLayoutEffect` 교체
  - 모듈 top-level에서 `document.documentElement.classList.add("has-desktop-sidebar")` 즉시 실행 (md+ CSS 전용, 모바일 무영향)
- `src/App.tsx`
  - `StakeStyleSidebar` lazy import → 정적 import 교체 (+1.5KB gz)
  - `MobileShell`은 lazy 유지

결과: PC 232px 사이드바 + main padding-left 첫 페인트 동기화, 페이지 이동 시 점프/깜빡임 제거.

### 2. Hero 완전 재설계
- `src/components/dashboard/v3/DashboardHeroV3.tsx`
  - Headline: "오늘 사람들이 가장 많이 참여 중인 실시간 리워드 챌린지"
  - Sub: "무료 예측 · 무료돈벌기 · 실시간 보상 · PHON 받기"
  - Primary CTA: "무료 시작하기" → `/earn`
  - Secondary CTA: "체험 모드" → practice mode 토글
  - 기존 라이브 티커/골드 그라디언트 유지

### 3. Crown Icon Strict 0
- `src/components/collection/CollectionHubTabs.tsx`
  - `Crown` (lucide-react) → `Sparkles` 교체
  - `check-no-crown-ui.mjs` strict 0 달성

## 검증
- `node scripts/check-no-crown-ui.mjs` → 0건
- `node scripts/check-money-flow-freeze.mjs` → 8경로 PASS
- PC(1440) + Mobile(375/390) 사이드바 / Bottom Nav 5탭 페인트 확인
- Bottom Nav 5탭 라우트: 홈 `/dashboard` · 무료돈벌기 `/earn` · 실시간대결 `/duel` · 실시간예측 `/trade` · 내PHON `/phon`

## 절대 금지
- 머니플로 8경로 (award_crown / Treasury / Founding Season / reward engine / withdrawal / settle / split / oracle) 수정
- P0 인증·체결·슬롯 엔진 수정
- Crown 백엔드 RPC/테이블 수정
- 새 기능 추가
