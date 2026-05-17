# Phase E — Final UI/UX Polish (Stake급 세련 × Warm King × 모바일 OS-like)

목표: 모든 주요 화면을 한 번에 갈아엎는 대신, **공통 프리미티브 → 핵심 화면 → 디테일** 순으로 슬라이스해 회귀를 0에 가깝게 유지하면서 체감 품질을 단계적으로 끌어올린다. money-flow 8경로 / Operator Isolation / Bundle Budget은 모든 슬라이스에서 무손상.

## Slice E1 — Mobile OS Primitives (이번 턴 작업)

가장 자주 보이는 5개 프리미티브를 통일. 페이지 코드는 단 한 줄도 갈아엎지 않고, 기존 컴포넌트가 자연스럽게 새 모습을 갖도록 한다.

1. **BottomSheet (`src/components/ui/bottom-sheet.tsx`)**
   - vaul 기반(이미 설치됨). iOS 시트 핸들, safe-area, 백드롭 블러, 스냅 포인트(40%/90%).
   - 기존 Dialog 중 모바일에서 시트가 더 자연스러운 케이스에서 옵트인.
2. **Sonner 토스트 글로벌 톤 통일 (`src/components/ui/sonner.tsx`)**
   - Warm Gold/Amber 그라디언트 보더, 24px radius, 백드롭 블러 14px, 진입 spring.
   - notify 4-tier 매핑 그대로 유지.
3. **FloatingFab 공통 컴포넌트 (`src/components/ui/floating-fab.tsx`)**
   - LobbyFab/FloatingChat을 동일 톤·동일 진입 애니메이션으로 정렬. shadow/ring/active:scale-95 일치.
4. **Page transition (`src/components/ui/page-transition.tsx`)**
   - 18ms fade + 8px translateY, prefers-reduced-motion 자동 OFF. Suspense 폴백을 감싸는 wrapper.
5. **Bottom Nav haptic + active glow (`src/components/Layout.tsx` 의 BottomNav 부분만)**
   - 아이콘 active 시 warm gold halo + 살짝 lift, navigator.vibrate(8) (지원 시).

## Slice E2 — 핵심 화면 4종 폴리시 (다음 턴)

- Auth (로그인), Dashboard, /trade, /phon — 헤더 hierarchy, spacing rhythm(4·8·12·16·24), 첫 화면 LCP 요소 typography 정리. 라우팅·로직 변경 0.

## Slice E3 — 게임 로비 + 카드 시스템 (그 다음 턴)

- /games · /casino 카드 깊이감, 진입 prefetch hover, "지금 잭팟 대기 중" 펄스. 슬롯 페이지 내부는 손대지 않음.

## Slice E4 — FOMO / 중독성 디테일

- 매일 입장 streak 시각화 강화, 출금 라이브 카운터 위치 조정, "어제 폐하 N명 출금" 1줄 배너.

## 보호 가드 (모든 슬라이스 공통)

- money-flow 8경로(`PRJ_FREEZE_RAW_CHANNEL`) git diff = 0줄
- `node scripts/check-operator-isolation.mjs` PASS
- `npm run size:check` PASS — index ≤ 180KB gz, slots/wallet/lobby 청크 변동 없음
- raw `supabase.channel(...)` 0 추가
- 디자인 토큰만 사용(HSL var), 인라인 hex 금지(기존 v3 로비 파일은 예외 — three.js color 입력)

## 비범위 (이번 슬라이스에서 안 함)

- 신규 비즈니스 기능, RPC, 마이그레이션
- 페이지 구조/IA 변경
- three3d 청크 손대기 (Phase D 완료 상태 동결)
