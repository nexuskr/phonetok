
# 🛡️ PHASE 3 — ORACLE FORTRESS

> **"단일 오라클 = 단일 장애점."**
> v3.2 커널이 신뢰하는 유일한 입력값(`oracle_prices.last_price`)이 지금은 **Bybit 한 군데**에서만 옵니다.
> Bybit가 30초만 멈춰도 모든 신규 포지션이 `oracle_stale`로 막힙니다.
> 다중 거래소 합의 기반의 **요새형 오라클**로 바꿉니다.

---

## 현황 (1분 진단)

- `oracle_prices` 테이블: `symbol PK / last_price / source(text) / updated_at` — 단일 row per symbol, 단일 소스.
- `oracle-refresh` 엣지 함수: Bybit v5만 폴링, 10초 간격 cron.
- v3.2 커널: `last_price`를 그대로 신뢰 + 5초 freshness gate + ±0.5% sanity check.
- 현재 위험: Bybit API 장애 / 가격 이상치 / 단일 거래소 조작 시 커널 무방비.

---

## 목표 (Definition of Done)

1. Bybit / Binance / Coinbase **3개 소스를 동시 수집**, 각자 row 보관.
2. **Median 합의**로 `oracle_prices.last_price` 계산 (3중 다수결).
3. **이상치 자동 격리**: median 대비 ±0.3% 벗어난 소스는 weight=0 (그 회차 제외).
4. **Quorum 실패**(≤1 소스만 fresh) 시 `oracle_quorum_lost`로 raise — 커널이 신규 포지션 차단.
5. 관리자 화면 **Oracle Health 패널**: 소스별 lag/divergence/quorum 상태, 단 1개 거래소가 다운돼도 한눈에 식별.
6. 카오스 검증: 한 소스를 임의로 죽여도(=stale 시뮬) 커널이 무중단으로 돌아간다.

---

## 작업 분해

### 1. DB 스키마 (마이그레이션 1건)

신설 테이블 `oracle_prices_raw` (소스별 원본):
```text
oracle_prices_raw
  symbol      text
  source      text     -- 'bybit' | 'binance' | 'coinbase'
  last_price  numeric
  updated_at  timestamptz
  PRIMARY KEY (symbol, source)
```
- RLS: `authenticated SELECT true`, INSERT는 SECURITY DEFINER만.
- 인덱스: `(symbol, updated_at DESC)`.

기존 `oracle_prices`는 그대로 유지(합의 결과 캐시), 컬럼 추가:
- `quorum_count int NOT NULL DEFAULT 0` — 합의에 참여한 소스 수.
- `divergence_bps int` — median 대비 최대 편차(bp).
- `participating_sources text[]` — 합의 참여 소스 목록.

신설 RPC:
- `compute_oracle_consensus(_symbol text)` — `oracle_prices_raw`에서 5초 이내 fresh row만 모아 median 계산 + 이상치 제거 + `oracle_prices` upsert. 결과 반환.
- `admin_get_oracle_health()` — 심볼×소스 매트릭스, 각 셀에 last_price/age_s/divergence_bps/healthy 플래그, quorum 요약.

cron `oracle-consensus-tick`: 매 5초 모든 심볼에 대해 `compute_oracle_consensus` 실행.

커널 변경 없음(이미 `oracle_prices`에서 읽기 때문에 자동 적용). 단 `result` jsonb에 `quorum_count` / `divergence_bps` 추가 기록.

### 2. 엣지 함수 (3개)

- `oracle-refresh-bybit` — 기존 `oracle-refresh` 리네임 + `oracle_prices_raw`로 upsert (source='bybit'). 5s cron.
- `oracle-refresh-binance` — Binance `/api/v3/ticker/price` 폴링. 5s cron.
- `oracle-refresh-coinbase` — Coinbase `/products/{sym}/ticker` 폴링 (또는 batch endpoint). 5s cron.

각 함수는 **자기 소스만** raw 테이블에 쓰고 끝. 합의는 DB cron이 담당 → 책임 분리.

### 3. 관리자 UI

`/admin` 신규 탭 **"oracle"** = `<OracleFortress />`:
- 상단: quorum healthy 심볼 수 / degraded(2 소스) / down(≤1) — 색 코딩.
- 심볼×소스 매트릭스 테이블: 각 셀에 가격·age·divergence·🟢/🟡/🔴.
- 5초 자동 갱신.
- AAL2 보호 (`SENSITIVE_ADMIN_TABS`에 추가).

### 4. 카오스 스크립트 (검증)

`scripts/oracle-chaos.ts`:
- 특정 소스의 raw row만 `updated_at = now() - 1min`으로 강제 백데이트(`admin_oracle_chaos_stale_source` 관리자 RPC).
- 직후 `compute_oracle_consensus` → 남은 2개로 계속 합의되는지 확인.
- 추가로 2개 소스를 죽여 quorum=1로 만들면 `live_open_position`이 `oracle_quorum_lost`로 거절되는지 확인.
- 카오스 종료 시 `admin_oracle_chaos_clear` 호출.

---

## 위험 / 결정 포인트

- **Coinbase 심볼 매핑**: `BTCUSDT` → `BTC-USD` (USDT 미지원 → USD 페어로 1:1 근사). PEPE/SHIB1000 같은 미상장 심볼은 quorum=2 허용 정책으로 처리(Bybit+Binance만으로도 합의).
- **Quorum 임계**: 권장 `min_quorum=2`. 1로 떨어지면 freshness OK여도 `oracle_quorum_lost`. 운영 중 false-positive가 많으면 `trading_safeguards_config`에 `min_oracle_quorum` 컬럼 추가하여 운영자 조절 가능.
- **Divergence 임계**: median 대비 ±30bp(0.3%) 초과 시 격리. 알트코인은 변동성 커서 향후 심볼별 임계 분리 고려.
- **레이트리밋**: 5초 간격 × 25심볼 × 3거래소 = 분당 900콜. 모두 batch ticker endpoint 사용으로 거래소당 분당 12콜에 맞춤.

---

## 산출물 요약

- 마이그레이션: `oracle_prices_raw` 테이블, `oracle_prices` 컬럼 3개 추가, RPC 2종 + 카오스 RPC 2종, cron 1건.
- 엣지 함수 3개(rename 1 + new 2).
- 컴포넌트 1개(`<OracleFortress />`) + Admin 탭 등록.
- 카오스 스크립트 1개.
- 메모리 업데이트.

---

## 추천 진행

**오늘 한 번에**: 마이그레이션 → 엣지 3개 → Admin 탭 → 카오스 스크립트로 1회 검증.
승인하시면 위 순서대로 바로 시작합니다 — 한마디 "**가자**" 면 GO.
