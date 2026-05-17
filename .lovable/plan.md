# Phase 0-R — TRUE Clean Rebuild (Stake.com 급)

## 왜 다시 하는가

이전 Phase 0는 "마운트만 해제"였습니다. 실제로는 **Layout, App.tsx, Dashboard** 어디에도 옛 요소가 그대로 살아 있습니다:

- **글로벌 토스트/오버레이 17종 상시 마운트**: `EmpireMomentToast`(상단 골드 토스트 — 스크린샷의 "대공 S\*\*\*h 황제 잭팟 적중"), `NeonNotificationFeed`, `BaronPromotionDialog`, `EmpireBoosterTimer`(우상단 14:24 카운터), `EmpireConcierge`, `ReplayShareGlobal`, `CrownWarFinaleModal`, `PowerHeader`(우상단 5,200,000원/활성화/Lv.60), `FirstEmperorBurst`, `CrownThroneOverlay`, `ImperialInbox`, `QuickAccessStrip`, `EmpirePopulationPulse`, `ImperialHud`, `FloatingDockHost`, `SimGlobalBadge`, `PracticeModeBanner`, `EmpireMomentToast`, `FloatingCashLoopWidget`, `ForcedShareDialog`, `VipArrivalAnnouncer`, `ReactivationOfferDialog`, `BigWinShareHost`, `AchievementUnlockListener`, `LobbyFab`, `ImperialDeepLinkListener`.
- **좌측 사이드바**: 트레이딩/슬롯/제국 광장/황제 미션/내 제국 + Admin — 옛 5그룹 그대로.
- **Dashboard 본문**: ImperialLivePulseRail, ImperialLiveWinsRail, DashboardHeroV3, DailyBriefingCard, VipWhalePreview, ImperialJourneyMap, JourneyClaimPanel, TradingEntryCard, Olympus 카드, KpiGridV3, MoreSection, DashboardBetPanel — "잘라낸다"고 했지만 모두 살아있음.

스크린샷의 **모든 위젯/탭/토스트는 이 목록에서 나온 것** 입니다.

## 이번에는 진짜로 제거

### 1. Layout.tsx 완전 재작성 (Stake.com 스타일 셸)

옛 `Layout.tsx`는 **그대로 두고** (다른 페이지 안 깨지게), 새 `ImperialShell.tsx`를 만들어 Dashboard/Home/주요 페이지만 이걸 씁니다.

```text
┌───────────────────────────────────────────────────────────┐
│ TopBar:  [P PHONARA]    [search]    [잔액 ₩] [지갑] [👤] │
├──────────┬────────────────────────────────────────────────┤
│ Sidebar  │                                                 │
│  슬림     │   메인 컨텐츠                                    │
│  (아이콘) │                                                 │
│  Home    │                                                 │
│  Trade   │                                                 │
│  Slots   │                                                 │
│  Live    │                                                 │
│  Wallet  │                                                 │
└──────────┴────────────────────────────────────────────────┘
```

- 사이드바: 5개 아이콘 + 라벨, 그룹 없음, Admin 분리
- 옛 그룹 아코디언/Accordion 컴포넌트 완전 제거
- Stake처럼 매우 어두운 #0F1419 배경, 미세 보더, 골드 강조 최소화

### 2. App.tsx 글로벌 오버레이 17종 모두 언마운트

다음 정적/Lazy 임포트와 마운트를 모두 삭제 (파일 자체는 남겨둠 — 다른 곳에서 import 깨지지 않게 하려고 `index.ts` 재export 도 유지):

- `EmpireMomentToast` ← 스크린샷 골드 토스트 주범
- `FloatingCashLoopWidget`, `ForcedShareDialog`, `VipArrivalAnnouncer`, `ReactivationOfferDialog`, `BigWinShareHost`, `AchievementUnlockListener`, `LobbyFab`, `ImperialDeepLinkListener`, `FloatingDockHost`, `PracticeModeBanner`, `SimGlobalBadge`
- 우상단 RUNTIME chip(`EntropyChip`)도 DEV-only 유지하되 시각적 노출 OFF

Layout 내부의 idle-mount 9종도 모두 삭제: `NeonNotificationFeed`, `BaronPromotionDialog`, `EmpireBoosterTimer`, `EmpireConcierge`, `ReplayShareGlobal`, `CrownWarFinaleModal`, `CrownThroneOverlay`, `PowerHeader`, `FirstEmperorBurst`, `EmpirePopulationPulse`, `ImperialHud`, `QuickAccessStrip`, `ImperialInbox`.

남는 것: `Toaster`(shadcn) + `Sonner` 만. 토스트는 명시적으로 부른 곳에서만 표시.

### 3. Dashboard.tsx — 한 화면 = Stake 카탈로그 1개

옛 11개 위젯 전부 삭제. 새 구성:

```text
┌─────────────────────────────────────┐
│ Hero search-row: "게임 검색…"        │
├─────────────────────────────────────┤
│ Quick chips: Slots · Live · Crash · Trade │
├─────────────────────────────────────┤
│ "Phonara Originals"  →    [캐러셀 6장]│
├─────────────────────────────────────┤
│ "Slots"              →    [캐러셀 6장]│
├─────────────────────────────────────┤
│ "Live Casino"        →    [캐러셀 6장]│
├─────────────────────────────────────┤
│ "Trading"            →    [BTC LONG/SHORT 카드]│
└─────────────────────────────────────┘
```

- 모든 카드 데이터는 **이미 있는** `src/pages/casino/*` 라우트 12개를 그대로 사용
- 깜빡임/펄스/glow 없음, 카드 hover 시 미세 lift만
- 토스트/배너/카운트다운/마키 0개

### 4. Landing.tsx 톤다운

현재 `Landing.tsx`(411줄 짜리 옛 `Index.tsx`가 아니라 새 Landing.tsx)는 Hero + Live Wins + Trust 로 이미 비교적 깔끔하지만:

- 마키(`ImperialLiveWinsRail`) 제거 — Stake은 랜딩에 마키 안 씀
- `pulse-halo`, `glow-imperial`, `animate-ping` 등 과한 효과 제거
- Hero 카피 유지하되 폰트 사이즈 줄이고 단일 CTA만

### 5. 옛 Index.tsx (`/legacy-index`) 라우트 제거

App.tsx 의 `<Route path="/legacy-index" element={<Index />} />` 삭제 + `Index.tsx` lazy import 삭제.

## 기술 세부

- 파일 신규: `src/components/shell/ImperialShell.tsx`, `src/components/shell/ImperialTopBar.tsx`, `src/components/shell/ImperialSidebar.tsx`, `src/components/dashboard/v19/GameRail.tsx`
- 파일 수정: `src/App.tsx`(글로벌 오버레이 17종 삭제), `src/pages/Dashboard.tsx`(전면 재작성), `src/pages/Landing.tsx`(톤다운), `src/components/Layout.tsx`(idle-mount 13종 삭제 + 사이드바 슬림화)
- 파일 삭제 없음 (다른 페이지가 import 중일 수 있음 — 마운트만 끊음)
- 라우트: `/legacy-index` 제거
- 디자인 토큰: 새 변수 `--stake-bg: 220 13% 9%`, `--stake-surface: 220 13% 12%`, `--stake-border: 220 13% 18%` 추가
- money-flow 코드, 토스트 라이브러리, 인증, 결제, DB는 **0줄도 안 건드림**

## 검증

빌드 후 `/`, `/command`(Dashboard), `/trade` 3개 페이지가 스크린샷 기준으로:

1. 우상단 골드 토스트 없음
2. 우상단 14:24 부스터 카운터 없음
3. 좌측 그룹 아코디언 없음(슬림 사이드바만)
4. RUNTIME chip 없음
5. Dashboard에 황실 브리핑/저니맵/올림푸스 카드/베팅 패널 없음 — 게임 카탈로그만

확인은 새 스크린샷 3장으로 첨부해서 보고합니다.
