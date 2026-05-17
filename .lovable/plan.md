# Slice 5 — Imperial Notification System Cleanup

산만하고 중복된 in-app 토스트와 실시간 알림을 정리하고, Imperial Empire + Warm King 톤으로 일관된 알림 체계를 구축한다. money-flow 8경로 / Operator Isolation / Bundle Budget / Phase D / Phase F Push 인프라는 0줄 변경.

## 결과물 (사용자 관점)

1. 게임/슬롯/트레이딩 결과 토스트가 대폭 줄어든다 — 잔돈성 승리/일상 피드백은 "황제 소식함"으로만 흐르고, 화면 토스트는 큰 이벤트(잭팟, 청산, 입출금, 승급)에만 뜬다.
2. 모든 토스트가 동일한 Imperial 외형(글래스 + Warm Gold 보더 + Crown 아이콘 옵션)으로 통일된다.
3. 동일 메시지/동일 키의 토스트가 짧은 시간 내 반복되지 않는다(dedupe).
4. "황제 소식함" 알림 센터가 강화되어 헤더 뱃지 카운트 + 최근 활동 타임라인을 보여준다.
5. Phase F Push 카피와 in-app 카피가 동일한 Warm King 톤으로 정렬되고, push deep-link는 기존 router 그대로 사용한다.

## 구현 범위

### A. `src/lib/notify.ts` 강화 (호환 유지)

- `critical / important / passive / silent` 4-tier 유지. 각 tier 호출에 선택적 `key?: string`, `crown?: boolean`, `deepLink?: string` 옵션 추가.
- 모듈 레벨 `Map<string, number>` dedupe: 동일 `key`가 마지막 표시 후 N ms 이내면 무시 (critical 0ms, important 8s, passive 4s).
- `imperial()` 헬퍼: Warm King 톤 프리셋(Gold 보더 + Crown 아이콘 + 옵션 CTA). 내부적으로 `important`로 위임.
- `result(kind: "win"|"loss"|"jackpot"|"liq", amount, meta)` 헬퍼: 게임/트레이딩 결과 라우팅을 한 곳에서 결정.
  - `jackpot` / `liq` → toast `imperial`.
  - 일반 `win` / `loss` → `silent` 이벤트만 발사 (토스트 없음).
- 기존 `success/error/info/warning/message/loading/fail/promise/dismiss` 시그니처는 그대로 유지(폭넓은 호출부 무수정 보장).

### B. 게임/트레이딩 결과 토스트 다이어트

다음 훅들의 결과 토스트를 `notify.result(...)`로 교체. 일상 승/패는 silent로 떨어지고, 큰 이벤트만 표시.

- `src/hooks/use-paper-positions.ts`
- `src/hooks/use-close-phon-position.ts`
- `src/hooks/use-open-phon-position.ts`
- `src/hooks/use-auto-bet.ts`
- `src/lib/trading/position-watcher.ts`
- `src/components/empire/betting/ImperialBetHistoryList.tsx` 내 결과 핸들러(필요 시)

청산/잭팟/대형 승리 임계값 상수는 `src/lib/notify-thresholds.ts`(신규)에 모은다.

### C. Imperial 외형 통일

- `notify.ts` `baseClass`/`variantClass`를 Warm Gold 톤(`border-amber-400/40`, `shadow-[0_0_24px_hsl(45_100%_60%/0.25)]`)으로 미세 업데이트 — 기존 토큰 사용, 신규 색상 추가 없음.
- `crown: true` 일 때 `description` 앞에 `<CrownGlyph />` 인라인 SVG 삽입(컴포넌트는 `src/components/empire/CrownGlyph.tsx` 신규, 8줄 수준).

### D. "황제 소식함" Notification Center 강화

- 기존 `src/components/NeonNotificationFeed.tsx`를 래핑하는 `src/components/empire/ImperialInbox.tsx` 신규.
  - `phonara:silent-notify` + 기존 `fomo_notifications` realtime을 한 스트림으로 합쳐 최근 30건 표시.
  - 헤더 트리거(Bell 아이콘 + 뱃지). 미열람 카운트는 sessionStorage `phonara:inbox:lastSeen` 비교로 산출.
- `src/components/Layout.tsx`에서 기존 `NeonNotificationFeed` 마운트를 `ImperialInbox`로 교체(컴포넌트 이름만 바뀌고 위치 동일).
- `FomoNotificationStrip` 마운트는 유지하되, dedupe key를 통해 동일 이벤트가 inbox+strip 양쪽에서 토스트로 중복되지 않도록 한다.

### E. Phase F Push 카피 정렬

- `supabase/functions/send-push/` 인프라 코드는 손대지 않는다.
- 클라이언트 측 in-app 미리보기/테스트 발송 카피(예: `NotificationPreferencesPanel.tsx`, `PushNotificationCard.tsx`)만 Warm King 톤으로 다듬는다.
- deep-link 라우터(`ImperialDeepLinkListener`)는 변경 없음 — 카피만 통일.

### F. ESLint 보강(옵션)

- 기존 `no-direct-sonner` 규칙 유지 확인. 추가 규칙은 도입하지 않음.

## 비대상 (변경 금지)

- `src/integrations/supabase/**`, `supabase/functions/send-push/**`, money-flow 8경로 파일군, Operator chunk 파일, Bundle Budget 설정.
- `@pkg/realtime` 4-파티션 래퍼 사용 규칙 — 신규 채널 추가 없음, 기존 구독 그대로.
- 군사/전쟁 어휘는 발견 시 Warm King 카피로 교체(예: "전투 결과" → "오늘의 승전보").

## 기술 메모

- dedupe Map은 200ms tick으로 만료 정리(메모리 누수 방지, `setInterval` 1개).
- `notify.result` 임계값 기본값: `jackpot ≥ amount*50` 또는 절대치 ≥ 100,000 PHON / `liq` 항상 toast / 일반 손익 silent.
- `ImperialInbox`는 lazy import로 헤더에 마운트(초기 번들 영향 최소화).
- 변경 파일 수 대략: 신규 4개(`ImperialInbox`, `CrownGlyph`, `notify-thresholds`, 옵션 storybook), 수정 8개 내외.

## 작업 순서

1. `notify.ts` 확장 + `notify-thresholds.ts` + `CrownGlyph.tsx` 작성.
2. 게임/트레이딩 훅 5종에서 `notify.result` 도입.
3. `ImperialInbox.tsx` 신규 + Layout 교체.
4. Push 카드 카피 정렬.
5. 빌드 통과 + freeze 검증(money-flow diff = 0 확인).
