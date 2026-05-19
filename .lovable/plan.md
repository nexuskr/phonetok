# Imperial Gold Empire — 7-Game Suite (Phase 4)

Imperial Crash 의 디자인·성능·머니플로 패턴을 베이스라인으로 6개 게임을 추가하고, Crash 자체도 한 단계 더 폴리시한다. 모든 게임이 동일한 시각 언어·인터랙션 톤·PF v2·realtime 파티션을 공유한다.

## 범위

- 신규 머니 RPC 0, 신규 테이블 0, WebGL/Three.js 0 (Canvas 2D + Framer Motion + CSS만)
- 머니플로 8경로 git diff = 0 — 모든 베팅/정산은 기존 `@/lib/*` 래퍼만 호출
- 게임별 라우트: `/games/<game>/imperial` (lazy)
- 7 게임 = Crash(폴리시) · Plinko · Roulette · Blackjack · Baccarat · Powerball · Wheel

## 결과물

### 1. Imperial Shared Core 업그레이드
`src/packages/games/core/imperial/`
- `theme.ts` — Deep Black + Imperial Gold HSL 토큰 (semantic만)
- `useGoldParticles.ts` — 풀-기반 60fps 파티클 훅 (Crash 캔버스에서 추출)
- `useFairnessBadge.ts` — PF commit/reveal 상태 표시 공용
- `ImperialStage.tsx` — 16:9 캔버스 셸 + 그리드 + 코너 샤인 + viewport pause
- `ImperialOverlay.tsx` — 중앙 라벨/카운트/멀티 오버레이
- `ImperialChipRow.tsx` — 퀵 칩 + 커스텀 입력
- `ImperialPrimaryCta.tsx` — Place/Cashout/Spin 통합 펄싱 CTA
- `ImperialHistoryRail.tsx` — 컬러 티어 히스토리 (Crash에서 일반화)
- `ImperialFairnessStrip.tsx` — hash/seed 스트립

### 2. 게임 패키지 (각 `src/packages/games/<game>/`)
공통 구조:
```text
<game>/
  index.ts              # barrel
  types.ts              # zod
  engine/
    <game>Engine.ts     # 순수 rAF/물리 (no DOM, no RPC)
    pf.ts               # imperial_pf_commit/reveal 어댑터
    index.ts
  components/
    Imperial<Game>Canvas.tsx   # 메인 캔버스
    Imperial<Game>BetPanel.tsx # 베팅 UI
  store/
    use<Game>Store.ts   # zustand 프레젠테이션 상태
```

게임별 핵심:
- **Crash** (폴리시): 멀티플라이어 광선 강화, near-miss 색온도 전환, 캐시아웃 슬로우모션 0.15s
- **Plinko**: 64-볼 풀 + Verlet 통합 + 핀 충돌 분석적 해, 골드 트레일, multiplier rail
- **Roulette**: 휠 회전(이지아웃 + 마이크로 바운스), 골드 림 반사, 볼 spiral-in
- **Blackjack**: 카드 deal 시네마틱(스택 → 부채꼴), bust/blackjack 폭발, 더블/스플릿 UI
- **Baccarat**: Player/Banker 카드 슬로우 리빌, squeeze 텐션, 페어/타이 보너스
- **Powerball**: 6볼 토네이도 추첨, 골드 글로 + 매치 카운트 펄스
- **Wheel**: 시네마틱 한바퀴+티커 슬로우, near-miss 인덱스 강조, 폭발 입자

### 3. 페이지 + 라우트
`src/pages/games/`
- `CrashImperial.tsx` (기존 폴리시), `PlinkoImperial.tsx`, `RouletteImperial.tsx`, `BlackjackImperial.tsx`, `BaccaratImperial.tsx`, `PowerballImperial.tsx`, `WheelImperial.tsx`

`src/App.tsx`: 7개 lazy 라우트 등록 + `/games` 로비 카드에 Imperial 진입점 노출

### 4. 머니플로 어댑터
각 게임은 `src/lib/<game>.ts`의 기존 `placeBet`/`settle` 류 래퍼만 호출. 래퍼가 없으면 어댑터 추가는 별도 PR로 분리 (이번 PR은 프레젠테이션 only). Crash/Roulette/Blackjack 은 기존 래퍼 확인 후 그대로, 나머지(Plinko/Baccarat/Powerball/Wheel)는 머니 RPC가 없으면 **"데모 모드 + Coming Soon CTA"**로 출시하고 실머니 RPC는 차후 합류.

### 5. 폴리시 & 가드
- 모든 캔버스: `useViewportPause`, `prefers-reduced-motion`, dpr cap 2
- 모든 베팅 패널: haptic select/win/error, notify Warm-King 토스트
- 모든 PF 사용: `useProvablyFair(game, roundId)`
- 모든 realtime: `@pkg/realtime` `useGameChannel` 만 사용
- 머니플로 가드: 신규 코드는 `imperial_place_phon_bet` / `request_withdrawal` 등 8경로 본문에 손대지 않음

## 머지 게이트

1. 빌드 그린 (TS strict)
2. 7개 라우트 진입 시 화면 렌더 + 60fps 유지
3. 머니플로 8경로 git diff = 0 (`git diff` 확인)
4. 신규 패키지가 dependency-cruiser 레이어 룰 위반 없음
5. Bundle: 각 게임 청크 ≤ 60KB gz (lazy chunk 격리)

## 기술 세부

- **Tech**: React 18 + Vite + TypeScript + Canvas 2D + Framer Motion + Zustand + Zod
- **No WebGL/Three** — Canvas 2D 만으로 시네마틱 톤 달성 (Crash 캔버스 검증)
- **Object pool** — 모든 파티클/볼 GC-free 64~128개 풀
- **컬러 토큰만** — `hsl(var(--gold))`, `hsl(var(--pink))`, `bg-background`, `text-foreground`. 인라인 hex 금지.
- **Font**: 프로젝트 기본 폰트 유지 (별도 폰트 추가 없음 — Pretendard/Clash 추가는 별도 PR)

## 비범위

- 신규 머니 RPC, 신규 테이블, WebGL/Three, 실시간 멀티플레이어 동기화, AI 코칭 통합, 글로벌 폰트 추가
- Plinko/Baccarat/Powerball/Wheel 실머니 RPC 작성 — 본 PR 은 프레젠테이션 + PF 데모. 실머니는 후속 PR.
