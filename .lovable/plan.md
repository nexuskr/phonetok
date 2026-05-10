# 오류 원인

```
column "direction" is of type tx_direction but expression is of type text
```

직전 핫픽스에서 `live_close_position` / `live_liquidate_position` / `admin_force_close_position`(2 오버로드) 함수를 재작성하면서 `transactions.direction` (enum `tx_direction`) 컬럼에 들어가는 값이 다음 형태로 작성되어 있습니다:

```sql
CASE WHEN v_pnl>=0 THEN 'credit' ELSE 'debit' END
```

PostgreSQL에서 CASE 식의 두 분기가 모두 문자열 리터럴이면 결과 타입이 `text`로 결정되며, `text → tx_direction` 암묵적 캐스팅은 허용되지 않아 INSERT 시 오류가 납니다. 단순 리터럴 한 개(`'debit'`)는 unknown 타입이라 통과되지만, CASE를 거치는 순간 막힙니다.

## 수정 범위 (4개 함수)

각 함수의 CASE 결과에 `::tx_direction` 캐스팅 추가, 그리고 단독 리터럴도 함께 명시적 캐스팅 적용(안전 차원).

1. `live_close_position`
2. `live_liquidate_position`
3. `admin_force_close_position(uuid)` — 인자 1개 오버로드
4. `admin_force_close_position(uuid, uuid)` — 인자 2개 오버로드

수정 패턴:
```sql
-- before
CASE WHEN v_pnl>=0 THEN 'credit' ELSE 'debit' END
-- after
(CASE WHEN v_pnl>=0 THEN 'credit' ELSE 'debit' END)::tx_direction

-- before
'debit', v_fee_close, ...
-- after
'debit'::tx_direction, v_fee_close, ...
```

## 작업 단계

1. 마이그레이션으로 위 4개 함수의 본문을 그대로 두고 INSERT 절의 `direction` 부분만 enum 캐스팅 추가하여 `CREATE OR REPLACE FUNCTION` 재선언.
2. 마이그레이션 직후 `pg_proc` 조회로 4개 함수 모두 `::tx_direction`이 포함되었는지 검증.
3. 사용자에게 F5 → 기존 ETHUSDT/BTCUSDT 포지션 "청산" 또는 "Close All" 클릭 → 토스트가 "성공"으로 뜨고 잔고 변화 확인 요청.
4. 정상 청산되면 직전 잔고 일관성 핫픽스(`Δtotal = Δavail + Δlocked`)도 함께 검증된 것이므로 추가 작업 없음.

## 영향 범위

- 트레이딩 외 다른 22개 함수에서 검색된 `'credit'`/`'debit'` 매칭은 대부분 jsonb metadata 내부 문자열이거나 단독 리터럴이라 정상 동작 중. 이번 오류는 CASE 결과 타입 결정 규칙 때문에 발생한 4개 함수 한정 문제이므로 그 외 함수는 건드리지 않음.
- 데이터/스키마 변경 없음, 함수 정의만 갱신.

## 리스크

- 매우 낮음. 캐스팅만 추가하므로 기존 잔고/PnL/수수료 계산 로직에 영향 없음.
- linter 0028/0029/0011 경고는 기존과 동일한 accepted risk.
