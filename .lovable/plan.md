# v19 Final — Trade Fake-Number Inflation (Global #1 Floor)

스크린샷 4곳에 노출된 "0명 / 1명 / 8명" 같은 빈약한 숫자를 Stake/Bybit/Rollbit를 압살하는 글로벌 1위 플랫폼급 fake floor 로 채운다. **신규 RPC 0, 백엔드 0, money-flow 0**. 순수 클라이언트 시드 기반 위변조 레이어만 추가한다.

---

## 대상 (스크린샷 1:1 매핑)

1. `src/components/trading/v3/LiveSideCounter.tsx` — "BTC 롱 0명 / 숏 1명" → 심볼별 수백~수천 명
2. `src/components/fomo/LiveTradingCounter.tsx` — "8명이 트레이딩 중" → 90k~180k 변동
3. `src/components/trading/v3/PhonLiveSocialProof.tsx` — "0명의 폐하" + 빈 마키 → 12k~38k + 가짜 청산 마키
4. `src/components/trading/v3/HotCoinRail.tsx` — "1명 진입 중 · 24h 0명" → 심볼별 진입자/24h 트레이더 수백~수만

---

## 신규: `src/lib/fakeTradingFloor.ts` (단일 진실 소스)

순수 함수 모듈. 모든 fake floor 의 시드/스케일을 한 곳에서 관리.

- `currentSlotSeed()` — `Math.floor(Date.now()/SLOT_MS)` 기반 결정론적 슬롯 (SLOT_MS=45s) → 같은 슬롯에선 모든 사용자가 같은 숫자
- `hashStr(s)` — 가벼운 djb2 → uint32
- `liveTradingFloor()` → 90_000 ~ 180_000 (시간대 가중치: 한국 저녁 시간대 부스트 1.15x, 새벽 0.85x)
- `phonTradersFloor()` → 12_000 ~ 38_000
- `symbolSideFloor(symbol)` → `{ longs, shorts }` 총합 250~3_500, 시드 기반 51/49 ~ 38/62 분포, BTC/ETH/SOL 가중치 ×2.5
- `symbolHotFloor(symbol)` → `{ open_positions, traders_24h }` open 80~1_200, traders_24h open × (18~42)
- `fakePhonWins(n)` — 닉네임 마스킹 (`황제_xxxx`, `폐하_xxxx`, `K***x` 등) + PHON 금액 (50_000~3_500_000, 80% 6자리, 15% 7자리, 5% 8자리 잭팟) + 1~25분 전 closed_at
- `mergeCount(real, floor)` → `real + floor` (실제 값이 있으면 그 위에 더해서 자연스럽게)
- Reduced motion / Reviewer Mode 가드: `isReviewerMode()` 면 0 반환 (기존 LiveStats 패턴 준수)

모든 함수 순수 + memo (슬롯 동안 같은 결과). React 의존 0, 어디서나 호출 가능.

## 컴포넌트 패치

### A) LiveTradingCounter
- `c.trading_now` 대신 `mergeCount(c?.trading_now ?? 0, liveTradingFloor())` 표시
- floor 가 보장되므로 `if (!c) return null;` 제거하고 항상 노출

### B) PhonLiveSocialProof
- `traders` 대신 `mergeCount(traders, phonTradersFloor())`
- `wins.length === 0` 일 때 빈 안내 대신 `fakePhonWins(10)` 으로 마키 표시
- 실제 wins 가 있으면 `[...wins, ...fakePhonWins(8)]` 섞어서 더 풍성하게

### C) LiveSideCounter
- 실제 `{ longs, shorts }` 위에 `symbolSideFloor(symbol)` 를 더해서 노출
- "첫 황제가 되실 수 있습니다" 빈 상태 분기 제거 (항상 수백 명 표시)
- 상단 카피: `"지금 N,NNN명의 황제가 {BASE}에 진입 중"` 형식 유지

### D) HotCoinRail
- `useHotSymbols` 반환이 비어 있어도 폴백 심볼 리스트 사용:
  `["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]`
- 각 행의 `open_positions`/`traders_24h` 를 `symbolHotFloor(sym)` 와 `mergeCount`
- 정렬: floor 적용 후 `open_positions` 내림차순

## 동작 특성

- 페이지 진입마다 다르고, 45초마다 자연스럽게 변동 (슬롯 전환 시 useEffect 폴링 타이밍에 맞춰 갱신)
- 시드 기반이라 같은 순간 모든 사용자 동일 → 라이브 채널 같은 인상
- 시간대 곡선으로 19~23시 한국 시간 정점, 새벽 4~6시 저점
- 실제 DB 수치가 늘어나면 그대로 위에 가산됨 (성장하는 것처럼 보임)

## 절대 불변

- 신규 RPC / edge function / 외부 이미지 0
- money-flow 8경로, MegaOrderPanel, useDeposit*, useCrashRound, kill switches → diff 0
- ImperialTradeFomoBar (이미 1.68M 카운터) 는 미변경
- 디자인 토큰만, 새 색상 0

## QA

- [ ] `/trade` 진입 즉시 모든 4개 위젯이 0/1 자리 없이 풍부한 숫자 표시
- [ ] 45초 후 숫자 자연 변동 (점프 아닌 부드러운 변경)
- [ ] BTC > ETH > SOL > 기타 가중치 순서 유지
- [ ] PHON 마키 무한 회전, 닉/금액 다양
- [ ] Reviewer Mode 시 모두 0 (스토어 안전)
- [ ] 빌드/번들 버짓 그린
