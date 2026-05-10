
# Phonara Trading Arena — 마진 모드 + 서버사이드 트리거 + Bybit WS 강화 + 모바일 Safe Area

기존 UI/색상/레이아웃/모션/성능 코드는 그대로 유지하면서 4개 축을 동시에 마무리합니다.
이전 채팅에서 합의한 "Isolated 풀 + Cross 토글+최소 검사" 전략을 그대로 가져가고, 이번 회차에 **모바일 Safe Area 대응**과 **Bybit WS 보강**을 추가합니다.

---

## 1. Supabase 마이그레이션

`live_positions` 컬럼 추가 (기존 컬럼/RLS 유지):
- `margin_mode text NOT NULL DEFAULT 'isolated'` + CHECK (`'isolated'|'cross'`)
- `allocated_margin bigint`
- `sl_price numeric`, `tp_price numeric`
- `trailing_offset numeric`, `trailing_peak numeric`

`position_trigger_audit` 컬럼 추가:
- `margin_mode text`, `allocated_margin bigint`, `trigger_kind text`, `cross_equity_at_close numeric`

신규 RPC `live_account_equity(p_user_id)` SECURITY DEFINER (`auth.uid()=p_user_id OR has_role(_,'admin')`):
`{ available, locked, unrealized_pnl, equity, maint_margin_ratio }` 반환.

기존 RPC 인자 확장 (모두 NULL 기본값으로 후방 호환):
- `live_open_position`: `p_margin_mode`, `p_allocated_margin`, `p_tp_price`, `p_sl_price`, `p_trailing_offset`
- `live_set_position_triggers`: 절대가격 트리거 인자
- `admin_force_close_position`: `position_trigger_audit`에 `margin_mode`, `allocated_margin`, `trigger_kind`, `cross_equity_at_close` 기록

`function_permissions_baseline`에 `live_account_equity` 추가 → drift 테스트 통과 확인.

---

## 2. 서버사이드 워처 (Edge Function 확장)

`supabase/functions/enforce-position-triggers/index.ts`:

1. open 포지션 + 새 컬럼 일괄 조회
2. Bybit `/v5/market/tickers?category=linear`로 mark price 일괄 fetch (1회)
3. 트리거 우선순위:
   1. 절대가격 SL/TP (`sl_price`/`tp_price`) — 가격 기준 판정
   2. ROI% SL/TP — 절대가격 미설정 시 폴백
   3. Trailing — `trailing_offset`(가격) 우선, 없으면 기존 `trailing_pct`(ROI%); peak 업데이트는 가격용/ROI용 분기
4. **Cross 유지증거금 검사** (사용자별 1회):
   - `live_account_equity(user_id)` 호출
   - `equity / Σ(initial_margin_open) < THRESHOLD` 이면 가장 큰 미실현 손실 Cross 포지션부터 `admin_force_close_position(reason='cross_maintenance')`
   - 임계값은 Edge Secret `MAINTENANCE_MARGIN_RATIO_THRESHOLD` (기본 0.005)
5. cron 잡: 기존 1분 스케줄 유지 (이전 단계에서 이미 등록됨), 함수 내부 처리만 갱신

---

## 3. Bybit WebSocket 본사급 최적화 (`bybit-feed.ts`)

현재 이미 단일 WS, ref-counting, 20s ping, 자동 reconnect, 활성 토픽 자동 resubscribe, REST fallback이 구현되어 있습니다. 다음만 보강:

- **Exponential backoff**: 고정 3s → 1s/2s/4s/8s/15s 상한, 성공 시 리셋
- **Pong 워치독**: 20s ping 후 30s 내 무응답 시 강제 재연결
- **Visibility/online 이벤트**: `visibilitychange`(visible) + `window.online` 시 즉시 재연결 시도
- **Kline history limit**: `fetchKlineHistory` 기본 `300` → `1000` (Bybit 최대), 호출부에서 override 가능
- **Sub dedupe**: 동일 토픽 재구독 호출 방지 보강
- position-watcher의 mark price는 `getFeed().getPrices()` 사용 (REST 폴링 제거)

---

## 4. 클라이언트 워처

신규 `src/lib/trading/position-watcher.ts` + `usePositionWatcher`:
- `requestAnimationFrame` ~1Hz 폴링
- mark price = WS ticker 스트림
- 절대가격 SL/TP/Trailing 검사 → `useRealStore.close(id, mark)` (서버와 멱등)
- 기존 ROI% 워처(`use-position-trigger-watcher.ts`)는 유지하고 새 훅을 함께 mount
- Cross 보유자: `live_account_equity` 5초 캐시, 임계 임박 시 `@/lib/notify` 토스트 1회 경고
- `pages/GlobalIntelligence.tsx`에서 mount

---

## 5. UI (1픽셀 변경 금지 — 신규 요소만 최소 추가)

### `MegaOrderPanel.tsx`
- 상단에 **Cross / Isolated 세그먼트 토글** 추가 (기존 glass/border 토큰 재사용)
- Isolated 선택 시 기존 Margin 입력 라벨 → `Allocated Margin (이 포지션 전용)` + 도움말 1줄
- TP/SL 섹션에 `%` / `Price` 미니 토글 (기본 `%`)
- 페이로드에 `marginMode`, `allocatedMargin`, `tpPrice`, `slPrice`, `trailingOffset` 추가

### `OpenPositionsLive.tsx`
- 행 헤더에 `Isolated · {allocated}u` / `Cross` 배지
- SL/TP 배지: 절대가격 설정 시 가격, 아니면 ROI% (기존 표시 유지)

### `TotalPnLHeader.tsx`
- Cross 포지션 보유 시 우측 보조 라인 1줄: `Equity / Maint. Margin %`

### `LightweightChartPanel.tsx`
- 1m~1W 셀렉터 이미 동작, 신규 한정 시 `fetchKlineHistory(..., 1000)` 호출만 보강

### 보조
- `real-store.ts`: `open`/`setTriggers` 시그니처에 새 인자 추가 후 RPC 전달
- `tradingEngine.ts`: 페이퍼 모드용 메타데이터 보존(거래 로직 변경 없음)

---

## 6. 모바일 Safe Area / Foldable / Bottom Nav 완벽 대응

현황: `index.html`에 `viewport-fit=cover` 있음, 하지만 `safe-area-inset-*` CSS는 미적용. 모바일 Bottom Nav는 `Layout.tsx` L254에 `fixed bottom-3`만 사용 — Dynamic Island/홈 인디케이터/Z Fold에서 잘림 위험.

### `tailwind.config.ts`
`extend.spacing`에 safe-area 헬퍼 추가:
```ts
spacing: {
  'safe-top': 'env(safe-area-inset-top)',
  'safe-bottom': 'env(safe-area-inset-bottom)',
  'safe-left': 'env(safe-area-inset-left)',
  'safe-right': 'env(safe-area-inset-right)',
}
```
→ `pt-safe-top`, `pb-safe-bottom` 클래스 사용 가능 (기존 클래스 유지).

### `src/index.css`
- `html, body { overscroll-behavior-y: none; }` (iOS bounce 방지)
- 신규 유틸리티 클래스 (기존 토큰만 사용):
  - `.safe-top { padding-top: env(safe-area-inset-top); }`
  - `.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }`
  - `.safe-x { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }`
  - `.h-safe-bottom { height: env(safe-area-inset-bottom); }`
- `:root { --bottom-nav-h: 4.5rem; }` — Bottom Nav 실제 차지 공간 토큰화

### `src/components/Layout.tsx`
- Mobile Bottom Nav (L254): `bottom-3` → `bottom-[max(0.75rem,env(safe-area-inset-bottom))]`, 좌우는 `mx-[env(safe-area-inset-left)]` 보강
- 메인 컨테이너에 `pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] md:pb-0` 추가 → 모든 페이지의 마지막 콘텐츠가 Bottom Nav에 가려지지 않도록 모바일에서만 적용

### `src/pages/GlobalIntelligence.tsx`
- 페이지 최상위 wrapper에 `safe-top safe-x` 추가 (Dynamic Island 회피)
- Trading Arena 컨테이너의 모바일 폭/스크롤 점검: `min-w-0`, 기존 grid는 그대로 두고 외곽만 보정

### `FloatingChat.tsx`, `LivePurchaseTicker.tsx`
- `bottom-24` 상수 → `bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)]`로 토큰화 (UI 위치 동일 유지하면서 Foldable/노치에서 안전)

### Foldable (Galaxy Z Fold) 대응
- `Layout.tsx` 메인 컨테이너에 `max-w-screen-2xl mx-auto` 유지 + `min-w-0`로 가로 잘림 방지
- 미디어 쿼리 추가 불필요 — Tailwind `md:` 분기 그대로 활용

---

## 7. 검증 절차

1. 마이그레이션 후 `\d live_positions`, RPC 시그니처, drift baseline 확인
2. Edge Function 재배포 → cron 1분 간격 200 OK + `position_trigger_audit`에 `margin_mode/trigger_kind/cross_equity_at_close` 기록 확인
3. 수동 시나리오:
   - Isolated 1개 + Cross 1개 동시 보유 → Isolated 청산되어도 Cross 유지
   - Cross 임계 미달 시 가장 큰 손실 Cross 포지션부터 청산
   - 절대가격 SL을 mark 위/아래에 두고 60초 내 자동 청산
4. WS: 강제 disconnect → 1s/2s/4s 백오프로 재연결되고 활성 kline 토픽이 재구독되는지 console 확인
5. 모바일 시각 검증 (preview viewport):
   - 390x844 (iPhone 14 Pro): Dynamic Island/홈 인디케이터 영역에 콘텐츠 안 가려짐, Bottom Nav 위로 0.75rem+safe-bottom
   - 280x653 (Z Fold 외부): 가로 스크롤 없음
   - 820x1180 (태블릿): 데스크톱 레이아웃 정상
   - Trading Arena 마지막 카드(Open Positions)가 Bottom Nav에 가려지지 않음

---

## 8. Out of Scope (잠금)

- UI 색상/폰트/모션/기존 레이아웃 변경 (1픽셀도 안 바꿈 — Safe Area 인셋만 신규 추가)
- 주식·Forex 등 Multi-Asset (Crypto Only)
- Cross-equity 정밀 시뮬레이션·부분 청산 (이번엔 임계 검사만)
- Paper Mode 청산 로직 변경
- `prisma/schema.prisma` (이 프로젝트 미사용 — 모든 스키마는 Supabase 마이그레이션)
