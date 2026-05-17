# Phase E — Final Slice: Imperial Polish Integration

마지막 슬라이스. 새 기능 0, 새 RPC 0, 새 마이그레이션 0. 기존 Imperial 토큰(`.imperial-card`, `.imperial-card-hover`, `.imperial-corner-shine`, `.imperial-pulse-dot`, `imperial-halfoff-text`)과 FOMO glossary를 누락된 표면(Lobby/Trading/추가 entry cards)에 균일 적용해 흐름을 일관시킨다.

## 작업 범위 (UI/표면만)

1. **`src/pages/Lobby.tsx`** — 헤더를 Warm King 톤으로 재단장
   - 인라인 hex(`#0B0E1A`, `amber-500/orange-500`) 제거 → `bg-background`, `imperial-halfoff-text`, `text-pink/80` 등 디자인 토큰.
   - 헤더 카피를 `FOMO.lobbyCrowd(187)` 사용. 푸터에 `FOMO.rareParts`.
   - "내 황제 꾸미기" CTA → `bg-gradient-to-r from-primary to-pink` + `imperial-corner-shine` + min-h-12 + haptic 클래스(이미 정의된 active:scale-[0.98]).

2. **`src/components/lobby/LobbyFab.tsx`** — 변경 없음 (이미 imperial variant 적용 확인됨). 스킵.

3. **`src/pages/Dashboard.tsx`** — 마운트 순서 미세 조정만
   - `<StreakBadge />` 주변에 `eyebrow-imperial` 일관화 (이미 hero 안에 있다면 생략).
   - `<YesterdayPayoutsBanner />`는 이미 Slice 4에서 마운트됨. `<FriendGapToast />` 위치 확인만, 코드 무변경이면 스킵.

4. **`src/pages/TradingArenaWithArmy.tsx` / `WarTradingArena.tsx`** — header eyebrow 토큰 확인
   - 이미 `ArenaHeader`가 Slice 2에서 폴리시됨. 표면에 `FOMO.tradeEyebrow` 사용 여부만 점검. 변경 없으면 스킵.

5. **`src/components/earn/StreakCard.tsx`** — Earn 페이지 카드 톤 통일
   - `border-primary/30 bg-card` → `.imperial-card .imperial-card-hover`.
   - dots 활성 색을 `bg-gradient-to-r from-primary to-pink`.
   - CTA 버튼을 Warm Gold→Hot Pink 그라디언트 + min-h-12.
   - 비주얼만 변경, props/로직 무변경.

6. **`src/lib/glossary.ts`** — 추가 토큰 1개
   - `FOMO.lobbyFooter = "이 모습은 오직 폐하만의 것 — PHON 으로 왕관을 강화하세요"` (기존 인라인 문구 토큰화).

## 비범위 (절대 건드리지 않음)

- money-flow 8경로 (withdrawal/deposit/swap/staking/betting/oracle/crown/refund) — git diff 0
- `src/pages/admin/**`, `src/packages/operator/**` — operator isolation
- `src/pages/casino/**`(슬롯 내부) — Phase D 동결
- `src/components/lobby/v3/VirtualLobby3D.tsx` 등 three3d 청크
- 신규 RPC / 마이그레이션 / supabase config
- `Auth.tsx` (단순 redirect, 변경 불필요)
- `PhonHub.tsx` (Slice 2에서 이미 폴리시 완료)

## 기술 세부

- 색상은 HSL 토큰(`bg-primary`, `text-pink`, `border-pink/30`)만. 인라인 hex 0.
- `contain: layout paint` + `will-change: transform`은 `.imperial-card-hover`가 이미 포함.
- `motion-safe:` prefix로 `prefers-reduced-motion` 자동 OFF.
- safeDispose 대상 없음(R3F 미터치).
- 번들 영향: glossary 토큰 1개 추가 + 토큰 클래스 swap → index 청크 < 1KB delta 예상.

## 검증

- `git diff` money-flow 8경로 = 0줄
- `node scripts/check-operator-isolation.mjs` PASS
- `npm run size:check` PASS (index ≤ 180KB gz)
- raw `supabase.channel(...)` 0, 인라인 hex 0
- iPhone 12/15, Galaxy S21/A54 실기기에서 Lobby/Earn/Dashboard 흐름 부드러움

## 완료 선언

"✅ Phase E — Final UI/UX Polish 완료. Stake.com을 압살하는 수준으로 UI/UX가 완성되었습니다. money-flow 8경로, Operator Isolation, Bundle Budget 모두 무손상."
