# v19 — Ultimate Stake Crusher: Dashboard & Landing Final

목표: 들어가자마자 3초 만에 "와… 미쳤다" 충격을 주는 Stake/Rollbit/Freecash 압도 수준의 Dashboard + Landing. 새 백엔드/머니플로 변경 0줄. 시각·FOMO·모바일 UX만 손본다.

## 결과물 (사용자가 보게 될 것)

1. **Landing (`/`)** — 단일 히어로 "0원으로 시작해서 매일 돈을 버는 제국" + Live Activity Engine + Trust 3-line + CTA. 군대/배틀/산만 카드 0개.
2. **Dashboard (`/command`, `/dashboard`)** — Hero → Live Activity Engine → Quick Action Chips → Imperial Trade Section (큰 차트 + LONG/SHORT) → Phonara Originals 캐러셀 → Popular Slots 캐러셀 → More Section(미션/스트릭/랭킹 작은 카드).
3. **Mobile** — 기존 5탭 하단 nav + 중앙 PHON FAB 유지(이미 슬림됨). 썸존·breathing glow 최종 점검.
4. **성능** — Layer 1 번들 미증가, LCP 1.2s 목표, reduced-motion 가드.

## Scope (지금 손대는 파일)

- `src/pages/Landing.tsx` — Hero 직후에 ImperialLiveActivity 삽입. 그 외 구조 유지.
- `src/pages/Dashboard.tsx` — 전면 재구성(아래 레이아웃대로). 기존 ORIGINALS/SLOTS 데이터는 그대로 재활용.
- `src/components/live/ImperialLiveActivity.tsx` *(신규, 시뮬레이션 전용 / DB·RPC 0)* — 8~12초마다 새 행 slide-in. 닉네임 풀(한국+해외), KRW/PHON/USDT 비율, 잭팟 행 골드 글로우.
- `src/components/dashboard/ImperialTradeSection.tsx` *(신규, presentation 전용)* — 기존 `useBybitTicker` 훅 1개만 사용해 BTC mini sparkline + LONG/SHORT 큰 버튼 → `/trade` 이동. 신규 RPC 0, money-flow 0.
- `src/index.css` — 필요한 토큰 보강(있으면 재사용). gold/pink glow, particle overlay, breathing 키프레임은 이미 존재 → 추가 없음 원칙, 부족할 때만 1~2개.

## 손대지 않는 것 (불변)

- `src/App.tsx` (라우트·Provider), `src/components/Layout.tsx` (사이드바·하단 nav·FAB는 Slice 7.5 결과 유지).
- money-flow 8경로, Operator Isolation, Bundle Budget, Phase D/F push, Realtime 파티션.
- 백엔드(Supabase) 마이그레이션 0, edge function 0, RPC 0.
- 옛 글로벌 오버레이(EmpireMomentToast/PowerHeader/BoosterTimer 등) — 이미 마운트 해제 상태 유지.

## Dashboard 최종 레이아웃

```text
[ Hero ]
  Cinzel 초대형 헤드라인 — "0원으로 시작해서 / 매일 돈을 버는 제국"
  Gold→Pink gradient text + multi-layer drop-shadow + 정적 골드 입자 오버레이
  ambient radial glow 배경

[ Imperial Live Activity Engine ]  ← Hero 직후 (full variant)
  · 6행 표시, 8~12s 마다 새 행 slide-in (framer-motion)
  · 컬럼: 시간 · 닉네임(마스킹) · 액션(승리/출금/잭팟/입금) · 금액
  · 닉네임 풀: 서준이, 민지99, 하린님, 도윤2, Alex92, LunaK, Kai007, Sora_jp 등
  · 통화 비율: KRW 45 / PHON 35 / USDT 20
  · 잭팟 행: gold glow + Crown 아이콘 + scale pulse + "JACKPOT" badge
  · reduced-motion: 슬라이드 → 즉시 fade

[ Quick Action Chips ]
  Slots · Live · Crash · Trade · Empire (이미 있는 칩 톤 강화)

[ Imperial Trade Section ]
  좌: BTC/ETH/SOL 토글 + 큰 sparkline (useBybitTicker 1개 훅 재사용)
  우: 큰 LONG (emerald glow) / SHORT (rose glow) 버튼 2개 → /trade?side=long|short
  하단 1줄: "PHON 잔액으로 즉시 진입 · 평균 체결 0.8초"

[ Phonara Originals ]  가로 캐러셀 (snap-x, 모바일 1.5장씩 보임)
[ Popular Slots ]      가로 캐러셀

[ More Section ]  3-up 작은 카드: 오늘의 미션 / 출석 스트릭 / 친구 랭킹 진입
```

## Landing 최종 레이아웃

```text
[ Hero ]  (현행 유지, 카피·글로우 그대로)
[ Imperial Live Activity Engine ]  ← Hero 직후 (compact variant: 4행)
[ Trust 3-line ]  (현행 유지)
[ Footer ]
```

## FOMO / 카피 가이드라인

- 모든 표현은 "황제 / 폐하 / 제국 / 승전보 / Imperial Duel" 톤. "battle / war / army / 전투 / 전쟁" 0건.
- Live 행 예시: "민지99 님이 Olympus 1000에서 ₩1,240,000 승전" · "Alex92 님이 320 USDT 출금 완료" · "👑 하린님 JACKPOT 8,400,000 PHON".

## 성능 가드

- ImperialLiveActivity: setInterval 1개, `runtime.registry`로 trackInterval. 탭 hidden 시 자동 일시정지(IntersectionObserver).
- framer-motion 은 이미 사용 페이지에서만 async — 신규 정적 import 금지, 이 컴포넌트도 `motion/react` 동적 import 사용.
- Trade Section sparkline은 SVG 폴리라인(라이브러리 X).
- 모바일에서 캐러셀은 CSS scroll-snap만 — JS carousel lib 추가 금지.
- LCP 측정: Hero 텍스트(현행) 유지 → LCP element 동일.

## 기술 세부 (체크리스트)

1. `ImperialLiveActivity.tsx` 작성 — props: `variant: "full" | "compact"`, `rows?: number`. 시드 풀 상수, weighted random pick, jackpot 8% 확률.
2. `ImperialTradeSection.tsx` — `useBybitTicker("BTCUSDT")` 등 기존 훅 호출. 심볼 토글은 useState.
3. `Dashboard.tsx` 재배치 — 기존 `Rail`, `GameCardTile`, ORIGINALS/SLOTS 유지하되, 그리드 대신 가로 스크롤(`flex overflow-x-auto snap-x`)로 전환. 카테고리 칩 그대로.
4. `Landing.tsx` — `<Hero/>` 와 `<Trust/>` 사이에 `<ImperialLiveActivity variant="compact" rows={4} />` 한 줄 삽입.
5. 군대/배틀 어휘 sweep — `Dashboard.tsx`/`Landing.tsx`에서 잔존 텍스트 grep 후 교체(없을 가능성 큼).
6. QA: 데스크탑/모바일 스크린샷 + 콘솔 에러 0 + 라우트 `/`, `/command` 진입.

## Out of scope (이번에 안 함)

- 신규 라우트, 신규 페이지, 신규 RPC/edge function.
- Sidebar/Bottom Nav 구조 변경 (Slice 7.5 결과 그대로).
- 다른 페이지(/casino, /trade, /wallet 등) 내부 수정.
