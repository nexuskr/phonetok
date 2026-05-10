# Phonara Trading Arena — God-Tier 구축 플랜

## 1. 핵심 아키텍처

**듀얼 모드**
- **Real Mode**: `wallet_balances.available_balance` 실제 차감/증가, 모든 정산은 서버 RPC
- **Paper Mode**: 기존 `usePaperStore` (10,000 USDT, 일일 리셋 버튼)
- 화면 상단 큰 토글: 좌측 PAPER(청록) / 우측 REAL(골드+레드 글로우). Real 첫 진입 시 동의 모달.

**상시 적색 경고 배너**
- `RedDisclaimerBanner` (`fixed top-0 z-50`) 모든 트레이딩 화면 상단. EN/KO 2줄.
- Layout 상단 패딩 보정.

## 2. 서버 사이드 (Real Mode)

**기존 활용**: `wallet_balances`(available/locked/total), `transactions` 테이블

**마이그레이션**
- `tx_kind` enum 확장: `trade_open`, `trade_close_win`, `trade_close_loss`, `trade_liquidation`, `trade_fee`
- 신규 테이블:
  - `live_positions(id, user_id, symbol, side, leverage, margin, size, entry, liq_price, fee_open, opened_at, status)` — RLS: 본인+admin SELECT, INSERT/UPDATE 직접 금지
  - `live_trade_history(... + close_price, pnl, fee_close, roi, closed_at, reason)`
  - `insurance_fund(id=1, accumulated bigint)` — admin SELECT only
- 인덱스: `(user_id, status)`, `(opened_at DESC)`

**RPC (SECURITY DEFINER, auth.uid() 가드)**
1. `live_open_position(p_symbol, p_side, p_leverage, p_margin, p_mark_price)`
   - 검증: leverage 1~100, margin>0, available_balance ≥ margin+fee, 오픈 포지션 ≤ 5
   - 슬리피지 0.06% 불리하게 entry 보정 (long: +0.06%, short: -0.06%)
   - fee = margin * leverage * 0.001
   - `insurance_fund` += fee * 0.25
   - `available_balance -= margin + fee`, `locked_balance += margin`
   - `transactions` (trade_open + trade_fee) 기록
   - `live_positions` INSERT
2. `live_close_position(p_position_id, p_mark_price)`
   - 슬리피지 0.06% 불리 적용
   - pnl = (exit-entry)*size*dir, fee_close = exit*size*0.001, insurance += fee_close*0.25
   - 음수 보호 없음(잔고 floor 0), `locked -= margin`, `available += max(0, margin + pnl - fee_close)`
   - `live_trade_history` INSERT, `live_positions` DELETE, `transactions` 기록
3. `live_liquidate_position(p_position_id, p_mark_price)`
   - ROI ≤ -1 검증, margin 100% 손실, insurance += margin (소량 흡수)
   - `locked -= margin`, available 변화 없음
4. `live_get_open_positions()` — 본인 포지션 목록
5. `live_get_history(p_limit)` — 본인 청산 내역

가격 sanity: 클라가 보낸 mark_price는 서버 가드(±2%) — 추후 가격 오라클로 교체 여지.

**Realtime**: `live_positions` UPDATE/INSERT publication 추가.

## 3. 자동 청산 (Liquidation Watcher)

- Edge Function `liquidation-watcher` (verify_jwt=true, service-role 검증)
- pg_cron 30초마다 호출 → 모든 open position 점검 → ROI ≤ -1 인 포지션 강제 청산
- 클라이언트도 ROI 진행 중 추적해서 -100% 도달 시 RPC 호출 (이중 안전망)

## 4. 가격 피드 & 차트

- 25심볼: BTC ETH SOL BNB XRP DOGE ADA AVAX LINK MATIC DOT TRX LTC NEAR ATOM APT SUI ARB OP INJ PEPE SHIB WIF BONK FLOKI
- 기존 `bybit-feed.ts` 다중 구독 확장 + REST 폴백 유지
- `lightweight-charts` npm 추가 → 캔들 + 실시간 last line + 진입가/청산가 horizontal lines overlay

## 5. UI 재구성 — `/global-intelligence`

```
RedDisclaimerBanner          (sticky top, 적색)
└─ ModeToggle               (Paper ⇄ Real, 잔고 카운트업)
   └─ TradingArenaHero      (심볼 셀렉터, 24h 변동, 거래량)
      └─ LightweightChartPanel (캔들 + entry/liq lines)
         └─ MegaOrderPanel  (네온 LONG/SHORT, 1~100x 슬라이더, 25/50/75/MAX/ALL-IN)
            └─ OpenPositionsLive (실시간 PnL, 청산까지 % 바)
               └─ TradingHistoryGold (대박 골드 + 화염)
                  └─ ComboStreakHUD (연승 화염 게이지)
                     └─ DopamineLayer (confetti, 셰이크, 사운드)
```

**MegaOrderPanel**
- 슬라이더 1~100x (50x↑ 빨강 글로우 강화)
- 마진 입력 + 25/50/75/MAX + 큰 빨간 ALL-IN 버튼(펄스)
- 예상 청산가, 예상 수수료, 슬리피지, 예상 PnL @ ±5% 시뮬 표시
- 거대 LONG(emerald 네온) / SHORT(rose blood red) 버튼 — 클릭 시 풀 임팩트

**DopamineLayer (`@/components/trading/DopamineLayer.tsx`)**
- 승리(pnl>0): canvas-confetti 풀스크린 + 골든 ring explosion + CountUp + "LEGENDARY WIN" 디스플레이 + victory.mp3 (>5x ROI 시 더 큰 효과)
- 청산: 화면 셰이크 + 검붉은 비네트 + "LIQUIDATED" 글리치 타이포 + thud.mp3
- Near-Miss(-90~-99% ROI 진행 중): heartbeat 펄스 1.2s 루프 + 빨간 테두리 진동

**ComboStreakHUD**: 연승 카운터 + 화염 게이지(3+ 시 multiplier 뱃지). Real 모드만 서버 기록.

## 6. 상태/엔진

- `src/lib/trading/engine.ts` — computeSize/PnL/ROI/liq, fee 0.1%, slippage 0.06% 공통 함수
- `src/lib/trading/real-store.ts` — Zustand: positions[], history[], realtime 구독, RPC 래퍼
- `src/lib/trading/sounds.ts` — 사운드 프리로드(victory/thud/click/heartbeat)
- Paper 모드는 기존 store 유지, 통합 뷰 컴포넌트는 mode props로 분기

## 7. 보안 / 합법성

- Real Mode 첫 진입 시 동의 모달: "전액 손실 가능성을 이해합니다" 체크 + age_confirmed=true 검증
- `live_open_position` 호출 전 `account_freezes` 체크 → frozen 시 차단
- Disclaimer 컴포넌트 + Red banner 모든 트레이딩 화면 강제
- RLS: 직접 INSERT/UPDATE 봉쇄, RPC만 통과

## 8. 구현 순서

1. **DB 마이그레이션** (사용자 승인 후): enum 확장 + live_positions/history + insurance_fund + 5개 RPC + RLS + Realtime publication
2. `lightweight-charts` 의존성 추가
3. `src/lib/trading/` (engine, real-store, sounds)
4. `RedDisclaimerBanner` + `ModeToggle` + Layout 통합
5. `LightweightChartPanel` (25심볼, entry/liq overlay)
6. `MegaOrderPanel` (슬라이더, ALL-IN, 시뮬, RPC 호출)
7. `OpenPositionsLive` (Realtime 구독, 청산 % 바)
8. `TradingHistoryGold` (Real+Paper 통합, 대박 골드)
9. `ComboStreakHUD` + `DopamineLayer` (confetti/셰이크/사운드)
10. `liquidation-watcher` edge function + pg_cron (사용자 데이터 → insert tool)
11. QA: 청산 시뮬, 수수료 누적 검증, 잔고 음수 방지, 5포지션 제한

## 9. 기술 흐름

```text
[Client]                  [DB / RPC]
MegaOrder ─ rpc ──▶ live_open_position
                     ├ slip  entry *= 1±0.0006
                     ├ fee   = margin*lev*0.001
                     ├ insur += fee*0.25
                     ├ avail -= margin+fee
                     ├ lock  += margin
                     └ INSERT live_positions, transactions

PriceFeed (WS) ─tick─▶ Client tracks ROI
                     └ if <= -1 → rpc live_liquidate_position
                          └ DopamineLayer.liquidate()

CloseBtn ────── rpc ──▶ live_close_position
                     ├ pnl  = (exit-entry)*size*dir
                     ├ fee  = exit*size*0.001
                     ├ avail += max(0, margin+pnl-fee)
                     └ DopamineLayer.win() if pnl>0

pg_cron (30s) ─▶ liquidation-watcher edge fn ─▶ live_liquidate_position
```

## 10. 산출물

- 마이그레이션 1건, 신규 edge function 1건, 신규 파일 ~15개, 수정 ~3개
- 결과: `/global-intelligence`가 대형 거래소급 듀얼 모드 트레이딩 아레나로 전환
