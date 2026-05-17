# Slice 5 — Imperial Notification System Cleanup

산만한 토스트/실시간 알림을 정리하고 Warm King + Imperial Empire 톤으로 통일한다. 중요 이벤트만 강하게 띄우고, 잔돈성 알림은 "황제 소식함"으로 옮기거나 silent 처리한다.

money-flow 8경로, Operator Isolation, Bundle Budget, Phase D, Phase F Push 인프라는 0줄 변경. 디자인 토큰만 사용.

## 변경 범위

### 1. `src/lib/notify.ts` 강화
- `imperial(title, opts)` — Warm Gold 헤더 + 황실 카피 톤 헬퍼 (important tier 기반)
- `result({ kind: "win"|"loss"|"jackpot"|"liq", amount, symbol?, meta? })` — 게임/트레이딩/슬롯 결과 단일 진입점.
  - jackpot/대형 승리 → `imperial()` (강력 6s, Crown emoji, gold pulse)
  - 일반 win/loss(임계 미만) → `passive()` 또는 `silent()` + Inbox로 적재
  - liquidation → `critical()` 톤 (단, duration 8s, 무한 아님)
- `dedupeMap` (LRU 64, 4s TTL) — 동일 `(tier+title+key)` 반복 차단. 모든 tier 헬퍼 진입 시 통과.
- `inbox(item)` — Inbox 큐에 push (localStorage `phonara:inbox:v1`, 최대 50개) + `window.dispatchEvent("phonara:inbox-add")`.
- 기존 `success/error/info/warning/passive/important/critical/silent`는 유지(시그니처 호환).

### 2. `src/lib/notify-thresholds.ts` (신규)
- `JACKPOT_MIN_PHON = 50000`
- `BIG_WIN_MIN_PHON = 10000`
- `LIQ_LOSS_MIN_PHON = 5000`
- `WITHDRAW_BIG_PHON = 100000`
- helper: `classifyWinAmount(phon)` → `"jackpot"|"big"|"normal"|"small"`

### 3. `src/components/empire/ImperialInbox.tsx` (신규)
- 우측 상단 Bell 아이콘 + unread dot, 클릭 시 BottomSheet/Popover로 최근 50건.
- localStorage 기반 + 4-tier 채널 (`fomo_notifications` realtime은 기존 hook 그대로 활용).
- Warm Gold 헤더 "황제 소식함", 빈 상태 EmptyState 프리미티브.
- "모두 읽음" / 항목 클릭 시 deep link 이동.
- 마운트 위치: `src/components/layout/Layout.tsx` 헤더 우측 (기존 마운트 슬롯 있으면 재사용).

### 4. 결과 토스트 통합
다음 호출부를 `notify.result()` 또는 `notify.imperial()`로 교체:
- `src/hooks/use-close-phon-position.ts` — close 결과 (이미 notify.success/info, result로 정리)
- `src/hooks/use-paper-positions.ts` — paper 청산 → `result({kind:"liq"})`
- `src/hooks/use-open-phon-position.ts` — 진입 성공 → `passive()`
- 슬롯 결과 토스트 (rg로 찾는 슬롯 페이지들의 `notify.*("당첨…")` 호출)
- `NeonNotificationFeed.tsx` — 풀화면 toast.custom 제거, Inbox 적재 + 중요 kind만 imperial()

### 5. 정리/축소
- `use-user-notifications.ts` — `package_settle`/`profit_share` 등 잔돈성 → Inbox만 (toast 제거), `deposit_credit`/`withdrawal_complete`만 imperial() 유지.
- 군사·전쟁 어휘(쳐들어옴/전투/승전/전쟁 등) 카피 sweep → Warm King(황제/제국/소식/승전보).

## 절대 불변
- 입출금 RPC, 머니플로 8경로, raw `supabase.channel` 호출은 일절 손대지 않음.
- Phase F push edge function / sw-push.js 변경 없음 (Inbox는 in-app 전용).
- 기존 sonner Toaster 컴포넌트 스타일 유지.

## 검증
- `rg "from \"sonner\"" src/` 직접 호출 0 유지 (NeonNotificationFeed 토스트 제거 후).
- 게임 1회 플레이 시 동일 결과 토스트 2회 이상 안 뜸 (dedupe).
- 잭팟 시뮬레이션 → imperial() 1회 + Inbox 1행.

## 완료 보고
"✅ Slice 5 Imperial Notification System Cleanup 완료" + Slice 6 (Imperial Polish + 세계관 sweep) 준비 상태.
