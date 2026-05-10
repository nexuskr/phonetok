# Trading Arena — ALL-IN 버그 + Fee 표시 통일

## 문제 진단

### 1. ALL-IN 클릭 시 "insufficient balance"
`MegaOrderPanel.setPct(1)`이 `balance`(예: ₩61,366) 그대로 마진에 넣음.  
하지만 서버 RPC `live_open_position`은 **마진 + 오픈 수수료**(`margin × leverage × 0.1%`)가 잔액 이내여야 통과.  
100× · 0.1%이면 필요 잔액 = 마진 × 1.10 → 마진=잔액 그대로면 항상 부족.  
대형 거래소(Bybit/Binance)는 Max 버튼이 **수수료를 자동 차감한 최대 가용 마진**을 넣음.

### 2. Fee 표시가 모드마다 다름
`Fee 0.1% (USDT)` (Paper) vs `Fee 0.1% (KRW)` (Real) — 라벨·소수점 자릿수·환산값이 통일 안 됨.  
대형 거래소는 항상 동일 포맷(주로 USDT 기준 + 현지통화 환산)으로 표기.

---

## 변경 범위 (UI/프레젠테이션 한정)

수정 파일: `src/components/trading/MegaOrderPanel.tsx` 만.  
서버 RPC, 엔진 계산식, 잔액·체결 로직, 디자인 토큰은 1픽셀도 건드리지 않음.

### A. ALL-IN/퍼센트 버튼 — 수수료 차감 후 최대치

`setPct(p)` 변경:
- 현재: `raw = balance * p`
- 변경: `raw = (balance * p) / (1 + leverage * FEE_RATE)`
  - `FEE_RATE = 0.001`은 `@/lib/trading/types`에서 import (이미 존재)
  - KRW 모드: `Math.floor`, USDT 모드: 소수 둘째 자리 내림
- 25%/50%/75%에도 동일 적용 (그 비율 안에서 풀-사이즈 가능하도록)
- 100× ALL-IN 시: ₩61,366 → 마진 ₩55,787 (수수료 ₩6,136 ≤ 가용)

레버리지 슬라이더가 움직이면 마진 입력값은 자동으로 재계산하지 않음(사용자 입력 보존). ALL-IN을 다시 누를 때만 새 레버리지 기준으로 재계산.

### B. Fee 표시 통일

`Stat label="Fee 0.1% ..."` 한 줄을 두 모드 동일 포맷으로:
- 라벨: 항상 `Fee (0.1%)` (단위 표기 제거)
- 값: `fmtMoney(fee, unit, { decimals: unit === "USDT" ? 4 : 0 })`
- 아래 작은 글씨로 환산: `≈ ${fmtMoney(approxCross(fee, unit).value, approxCross(fee, unit).unit)}`
  - Real 모드: `₩6,136` + `≈ 4.3829 USDT`
  - Paper 모드: `4.3829 USDT` + `≈ ₩6,136`
- `Stat` 컴포넌트에 옵셔널 `sub?: string` prop 추가하여 환산값 표기

---

## 검증 체크리스트

- [ ] Real 모드 ALL-IN + 100× → LONG/SHORT 정상 진입 (insufficient balance 사라짐)
- [ ] 25%/50%/75% 버튼도 항상 진입 가능
- [ ] 레버리지 변경 후 ALL-IN 다시 누르면 새 레버리지 기준으로 마진 갱신
- [ ] Paper/Real 모두 Fee 줄에 USDT/KRW 두 값 동시 표시, 라벨 동일
- [ ] 잔액·청산가·사이즈·실제 PnL 계산식 변경 없음
