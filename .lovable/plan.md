# Slice 2 — Imperial Dashboard + Imperial Live Pulse Rail

Dashboard를 산만한 위젯 다발에서 **단일 Imperial Empire Hub**로 축약한다. money-flow 8경로, Operator Isolation, Bundle Budget, Phase D/F, Realtime 파티션은 0줄 변경.

## 결과 화면 구조 (top → bottom)

```text
[ChurnReactivationBanner]   (휴면 복귀자만, 안전 카피)
[ImperialLivePulseRail]     ← 신규 단일 위젯 (Slice 2 핵심)
[DashboardHeroV3]           (유지: 단일 CTA)
[DailyBriefingCard]         (유지, lazy)
[VipWhalePreview]           (VIP 전용, 유지)
[ImperialStoryRail]         (유지)
[ImperialJourneyMap]
[JourneyClaimPanel]
[TradingEntryCard]
[Olympus 1000 카드]
[KpiGridV3]
[MoreSection]               (접힘 영역 — 기존 카드 보존)
[Disclaimer]
```

## Imperial Live Pulse Rail (신규 컴포넌트)

`src/components/empire/ImperialLivePulseRail.tsx` — 1개 카드, 3행 압축:

1. **헤드라인**: "폐하, 지금 제국이 이렇게 돌아가고 있습니다" + 라이브 점멸 도트.
2. **3 메트릭 (가로 그리드)**:
   - 지금 로비에 있는 황제 수 (`useOnline()` 재사용)
   - 지금 출금 중인 황제 수 (`get_payout_ops_stats_24h` 의 in-flight count 또는 기존 LivePayoutCounter 소스 재활용)
   - 최근 24h 대형 승리/Whale 활동 (`get_whale_strikes_24h(_limit:=2)` — 최대 2개만 노출)
3. **CTA**: "지금 참여 · 첫 입금 보너스" → `/wallet?focus=deposit` (안전선: 결과 약속 ❌, 행동 권유 ✅).

스타일: Warm Gold 베이스 + Hot Pink Accent dot, 기존 `glow-imperial` / `text-gradient-imperial` / `font-imperial` 토큰 재사용. 새 색 토큰 추가 없음.

데이터 소스는 모두 기존 공개 RPC — DB/엣지 0 변경.

## 정리할 마운트 (Dashboard.tsx 상단부)

**삭제 (Dashboard에서만 unmount, 파일은 보존)**:
- `LivePayoutCounter`
- `YesterdayPayoutsBanner`
- `FriendGapToast`
- `LivePurchaseTicker`
- `DailyChest` / `LevelProgressBar` 두-칸 그리드 (Dashboard 상단에서 제거 — 게이미피케이션 페이지에 이미 존재)
- `EmpireSignature` (헤더 중복)

**MoreSection 내부에서 정리**:
- `FomoNotificationStrip`, `WhaleStrikeRail compact`, `FriendLeaderboard`, `FoundingContendersBadge`, `MachineFomoTicker` → Pulse Rail로 대체되므로 MoreSection에서도 제거 (파일은 보존, 다른 페이지 마운트는 무변경).
- `CrownWarHUD` 는 유지 (Crown 시스템 핵심).

**유지**: 그 외 MoreSection 내용 (HubTabs, 베팅 패널, RecoveryPrompt, WithdrawNudge, LiveRankingMarquee, CommandHero, EmpireP2EDashboard, BoostHeroCard, PersonalizedFeedRail+RevenueWidget, SevenDayChallenge, EmpireDayCountdown, AttendanceCard, TierComparisonCard, JackpotBanner, ActiveBotsMini, FirstMissionCard, LiveRanking).

## 어휘 정리 (Dashboard 가시 카피만)

- "베팅 패널" / "전투력" 등 군사적 표현 잔재 검색 → "황제 전략 / 폐하의 진입" 톤으로 치환. (Dashboard.tsx line 181 `우주 황제 베팅 패널` → `폐하의 전략 패널`.)

## 변경 파일

- **신규**: `src/components/empire/ImperialLivePulseRail.tsx` (~140줄)
- **수정**: `src/pages/Dashboard.tsx` — import 정리 + 상단 마운트 교체 + MoreSection 슬림화

기존 컴포넌트 파일은 **삭제하지 않음** (다른 페이지에서 사용 중일 수 있음 / 롤백 안전성).

## 카피 규칙 (재확인)

- ✅ "지금 참여하시면 첫 입금 보너스를 받으실 수 있습니다, 폐하."
- ❌ "지금 입금하면 역전 가능합니다." / "조금만 더 하면 됩니다."

## 검증

- `node scripts/check-money-flow-freeze.mjs` → PASS
- `node scripts/check-operator-isolation.mjs` → PASS
- `npm run size:check` → index delta ≤ +2KB (lazy import 한 컴포넌트 다수 제거되므로 오히려 감소 예상)
- 브라우저: `/dashboard` 진입 시 상단이 단일 Pulse Rail 1장으로 압축됐는지, 60s 갱신 동작, CTA → `/wallet` 이동
- realtime 채널: 신규 추가 없음 (`useOnline` 기존 채널 재사용)

## Slice 3 예고

Navigation + Half-Off Imperial FAB — `PhonaraNav` + `FloatingFab` Imperial 톤 강화, 50% 첫 입금 보너스 글로벌 FAB.
