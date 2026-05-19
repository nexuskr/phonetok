# Phase 4 — Imperial Gold Empire 7-Game Suite

## Goal
Imperial Crash를 베이스라인으로, 동일한 디자인 언어·PF v2·realtime·성능 패턴을 적용한 7개 게임 패키지를 완성한다. 머니플로 8경로 git diff = 0 절대 준수.

## Scope (7 games)
1. **Crash** — 기존 폴리시 (광선 강화, near-miss 색온도, 0.15s slow-mo cashout)
2. **Plinko** — 64-ball Verlet physics + analytical pin collision + gold trail
3. **Roulette** — easeOut + micro-bounce wheel + spiral-in ball + gold rim
4. **Blackjack** — 시네마틱 deal/flip + bust/blackjack explosion
5. **Baccarat** — Player/Banker slow reveal + squeeze tension
6. **Powerball** — 6-ball tornado + match pulse + gold glow
7. **Wheel** — cinematic slow ticker + near-miss emphasis

## Architecture

### Shared Core — `src/packages/games/core/imperial/`
- `theme.ts` — HSL semantic tokens (Deep Black + Imperial Gold)
- `useGoldParticles.ts` — 60fps object-pool 기반 (128개 풀)
- `useFairnessBadge.ts` — PF commit/reveal 뱃지 상태
- `ImperialStage.tsx` — 16:9 canvas shell + grid + corner shine + viewport pause
- `ImperialOverlay.tsx` — win/loss reveal overlay
- `ImperialChipRow.tsx` — bet 칩 row
- `ImperialPrimaryCta.tsx` — pulsing CTA
- `ImperialHistoryRail.tsx` — color-coded history rail
- `ImperialFairnessStrip.tsx` — fairness 검증 strip

### Per-Game Package — `src/packages/games/<game>/`
```text
<game>/
├── index.ts
├── types.ts            (Zod)
├── engine/
│   ├── <game>Engine.ts (rAF / 물리)
│   ├── pf.ts
│   └── index.ts
├── store/
│   └── use<Game>Store.ts (Zustand)
└── components/
    ├── Imperial<Game>Canvas.tsx
    ├── Imperial<Game>BetPanel.tsx
    └── ...
```

### Pages & Routes
- `src/pages/games/<Game>Imperial.tsx` × 7
- `src/App.tsx` — 7개 lazy route 등록 (`/games/<game>/imperial`)
- `/games` 로비에 Imperial 진입 카드 추가

## Tech & Guards
- Canvas 2D + Framer Motion + Zustand + Zod 만 사용 (WebGL/Three.js 금지)
- 모든 캔버스: `useViewportPause` + `prefers-reduced-motion` + `dpr cap 2`
- Object pool 64~128 (GC-free)
- 모든 베팅: haptic + Warm-King toast (`@/lib/notify`)
- 모든 PF: `useProvablyFair` 연동
- Plinko/Baccarat/Powerball/Wheel은 실머니 RPC 부재 → **데모 모드 + Coming Soon CTA**
- 디자인 토큰만 사용 (inline hex 금지)

## Work Order
1. Imperial Shared Core 9개 파일 구축
2. Crash 폴리시 패스 (광선/near-miss/slow-mo)
3. Plinko (시각 핵심)
4. Roulette → Blackjack → Baccarat
5. Powerball → Wheel
6. 라우트 등록 + `/games` 로비 카드
7. Extreme polish + mobile + perf audit
8. Final summary + 머지 게이트 리포트

## Merge Gates
- Build green, 7개 라우트 렌더, 60fps 유지
- 머니플로 8경로 git diff = 0
- 청크 ≤ 60KB gz/game
- dependency-cruiser 위반 0

## Non-goals
신규 머니 RPC, 신규 테이블, WebGL/Three.js, 멀티게임 통합 — 모두 제외.
