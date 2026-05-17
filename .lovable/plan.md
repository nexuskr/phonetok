# v19 Final — Trade Section ABSOLUTE EARTH #1 FINAL GOD MODE

Trade Section의 마지막 폴리시 패스. 새 RPC / edge function / 외부 이미지 없음. money-flow 8경로, Operator Isolation, Bundle Budget, Phase D/F, FREEZE 파일 diff 0.

## 1. Imperial Brand Identity 최종 락
- `ImperialLogo`(이미 생성됨) Hover/Active 극한 마무리:
  - Mark 8각 별 회전 0.5° → 1.2°, multi-layer halo에 1개 layer 추가(rose pink outer ring).
  - 6개의 작은 파티클 dot (motion, transform/opacity only, prefers-reduced-motion 가드).
  - Active 시 mark scale 0.96, wordmark 글로우 강화.
- 남은 wordmark hardcoded 위치 교체:
  - `src/pages/Welcome.tsx` 상단 PHONARA·EMPIRE OS 칩
  - `src/pages/Landing.tsx` 푸터 © PHONARA.WORLD
- `MobileOrderSheet` 헤더 wordmark를 `<ImperialLogo size="sm" withWordmark withWorld={false} to={null} />` 으로 교체해 일관성.

## 2. Global FOMO Engine — Ultra Polish
- `ImperialTradeFomoBar` 스케일/생동감만 강화 (값 범위는 기존 유지: 1.24M~2.85M):
  - drift 간격 2.5~7s → 1.8~4.5s (사다리급 체감).
  - LONG/SHORT spring stiffness 90→110, mass 0.8→0.7, ±5% jitter 추가 nudge.
  - Big jump 확률 8% → 11%.
  - 우측 LONG/SHORT 라벨에 mini 화살표 펄스(transform only).
- 신규 컴포넌트 없음. 숫자 floor 라이브러리(`fakeTradingFloor.ts`)는 그대로.

## 3. PHON / USDT Dual Betting — 마무리
- `PhonOrderPanel`:
  - 토글 active state에 amber→pink under-bar 추가 (이미 있다면 강화).
  - USDT 모드일 때 입력 옆 "≈ N PHON" inline preview 폰트 크기 +1, color amber-200.
  - % 버튼(25/50/75/MAX) hover/tap scale 0.97 + ring glow.
  - 잔액 부족 시 "지갑 → 코인 입금" CTA를 currency-aware (PHON 모드면 "지갑 → PHON 충전") 로.
- `PhonOrderConfirmSheet`: 기존 USDT 표시 유지, divider 위 micro-shimmer 1회 추가 (open 시 0.8s).

## 4. Mobile Native Speed — 60fps Lock
- `MobileOrderSheet`:
  - trigger button: idle breathing 주기 2.6s → 3.2s (CPU 절감), pressed transition 0.18s → 0.14s.
  - Sheet spring damping 32→34, stiffness 320→380 → open/close 체감 ~160ms.
  - `will-change: transform` 명시 (이미 있음), 백드롭 `backdrop-blur-sm` 유지.
- `PhonOrderPanel` LONG/SHORT 버튼 onClick → confirm sheet open 사이 동기 처리 보장 (불필요한 setState batching 제거 확인만).
- `ImperialLogo` mark/halo: `transform: translateZ(0)` + `will-change-transform` 추가.

## 5. Visual & Consistency 최종 락
- Trade 페이지 카드(Order, Chart wrapper, FOMO, Hot Coin, Phon Social Proof) border-radius `rounded-3xl`로 통일, border `border-amber-400/20~30` 톤 통일.
- Imperial Tone copy 점검 (이미 적용됨): "황제의 실전 트레이딩 홀", "황실", "수익게임" → 누락된 sub-heading 1~2개 보정.

## 변경 파일 목록
- edit `src/components/brand/ImperialLogo.tsx`
- edit `src/components/trade/ImperialTradeFomoBar.tsx`
- edit `src/components/trading/v3/MobileOrderSheet.tsx`
- edit `src/components/trading/v3/PhonOrderPanel.tsx`
- edit `src/components/trading/v3/PhonOrderConfirmSheet.tsx`
- edit `src/pages/Welcome.tsx` (wordmark 칩 교체)
- edit `src/pages/Landing.tsx` (푸터 wordmark 교체)
- edit `src/pages/TradingArenaBybit.tsx` (border-radius/border 토큰 통일만)

## 절대 준수
- money-flow 8경로 / Operator Isolation / Bundle Budget / Phase D/F / FREEZE 파일 → diff 0줄
- 신규 RPC / edge function / 외부 이미지 0
- 디자인 토큰만 사용, transform/opacity only, reduced-motion 가드 유지

## 최종 QA
- Desktop 1440px Trade 전체 스크린샷
- Mobile 390px Trade 전체 스크린샷 (FOMO Bar + USDT 토글 + Sheet trigger)
- Logo Hover / Active 스크린샷
- 45초 경과 후 FOMO 숫자 변동 캡처
- Console error/warning 0, Layout shift 0 확인
