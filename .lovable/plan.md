# Dashboard V3 끝판왕 + Ghost Empire 15,000명

두 작업을 한 번에 처리한다. ① /command(대시보드) 100vh Hero + Trading Card + KPI 4 + 접힘 More + 라이브 이벤트 스트림 재설계, ② Ghost Empire 봇 강도/라이브 카운터를 15,000명·분당 50~70 이벤트 스케일로 튜닝.

---

## PART A — Dashboard V3 (전환 UI)

### A1. 신규 컴포넌트

**`src/components/dashboard/v3/DashboardHeroV3.tsx`** — 100vh full-bleed
- `<CosmicBackdrop />` (이미 존재, GPU 친화) + 깊은 비네팅
- 상단 키커: `⟡ PHONARA · EST. 2026` (gold border chip, 기존 디자인 토큰)
- 중앙 거대 황금 Crown — `CosmicHero` 디자인 재사용 (pulse rings + shimmer)
- 헤드라인: "폰을 켜는 순간, 너는 이미 우주 황제다" (`text-3xl md:text-6xl`, gold gradient)
- Hero stats 2개 (큼직): `💰 {phon} PHON` · `👑 {NFT 티어 or "ROOKIE"}` — `useMyPower()` 사용
- **단 하나의 초대형 CTA** (`h-16 md:h-20`, gold gradient, pulse): "🚀 지금 제국을 지배하기"
  - 클릭 시 `window.dispatchEvent(new Event("phonara:focus-trade"))`
  - 이벤트는 More 섹션 자동 펼침 + `<TradingEntryCard>` scrollIntoView
- Hero 하단에 라이브 이벤트 스트림 3줄 (마키, 800~2000ms 랜덤 간격) — `<ActivityEventTicker variant="hero" />`
- `min-h-screen flex flex-col items-center justify-center`, 스크롤 유도 chevron 1개만

**`src/components/dashboard/v3/TradingEntryCard.tsx`** — Hero 바로 아래
- 큰 글래스 카드, gold border, pulsing accent
- 헤더: "⚡ 지금 바로 베팅"
- 본문 1줄: "LONG = 오르면 돈 / SHORT = 내리면 돈"
- 두 개의 거대 버튼: `[ 🚀 LONG ]` `[ 💥 SHORT ]`
- 카드/버튼 모두 `navigate("/arena")` (또는 LONG/SHORT은 query `?side=long|short`)
- `id="trading-entry-card"` (scroll target)

**`src/components/dashboard/v3/KpiGridV3.tsx`** — 정확히 4개
- 오늘 출금: `useTodayPayout()` → KRW
- 활동 중: `useOnline()` → "n명" (15,000 스케일)
- 내 제국: `useMyPower().nfts` 최상위 티어 (DIAMOND/GOLD/BRONZE/ROOKIE)
- Jackpot: 기존 jackpot RPC가 있으면 사용, 없으면 `formatKRW(12_480_000 + jitter)` (서버값 우선)
- 큰 카드 `grid-cols-2 md:grid-cols-4`, breathing room, gold accents

**`src/components/dashboard/v3/MoreSection.tsx`** — `<details>` 기반
- summary: "⌄ 더 보기 — 베팅 패널 / 미션 / 랭킹"
- children: 기존 컴포넌트 그대로 lazy 마운트 (`DashboardBetPanel`, `EmpireP2EDashboard`, `BoostHeroCard`, `PersonalizedFeedRail`, `RevenueWidget`, `Balance hero (luxury watch frame)`, `SevenDayChallengeCard`, `EmpireDayCountdown`, `MachineFomoTicker`, `AttendanceCard`, `TierComparisonCard`, Roulette 카드, Quests/SeasonPass/Achievements grid, `ActiveBotsMini`, Quick actions, Featured missions, `LiveRanking`)
- ref + `useImperativeHandle` 또는 controlled `open` state
- `phonara:focus-trade` 이벤트 수신 시 자동 open + `betRef.current?.focusAmount()` + scrollIntoView
- `?focus=bet` 쿼리도 동일 처리 (기존 동작 보존)

**`src/components/dashboard/v3/ActivityEventTicker.tsx`** — FOMO 핵심
- 클라이언트 이벤트 큐 + `setInterval` random(800~2000ms)
- 이벤트 풀: 🔥 수익 / ⚡ 연승 / 💥 베팅 성공 / 👑 신규 황제 / 🚀 LONG·SHORT 성공 / 💸 대형 출금
- 닉네임: `K***` `J***` `S***` 마스킹 (페르소나 풀에서 stub 또는 단순 랜덤 한글 이니셜)
- 옵션: realtime `bot_activity_events` 채널 구독 (있으면 실 데이터 우선, 없으면 클라 fallback)
- `variant="hero"` (3줄 마키) / `variant="strip"` (1줄)
- 가짜 "수백만명 접속" 카운터 절대 사용 X — 흐름만

### A2. `src/pages/Dashboard.tsx` 재구성
- import 정리: 신규 V3 컴포넌트 5개 추가
- 기존 above-the-fold(키커/오버레이/Particles/HubTabs/FOMO strip/Crown HUD/WhaleStrike/베팅 패널/CommandHero/EmpireP2E/...) 전부 **MoreSection 안으로 이동** 또는 제거
- 새 구조:
  ```tsx
  <Layout>
    <Suspense>{/* FirstDepositTopBanner, SixtySecondFlow, EarnedToast, OnboardingV2 (overlay만 유지) */}</Suspense>
    <DashboardHeroV3 />
    <div className="container py-8 space-y-8">
      <TradingEntryCard />
      <KpiGridV3 />
      <MoreSection ref={moreRef}>
        {/* 기존 카드들 그대로 */}
      </MoreSection>
      <Disclaimer />
    </div>
  </Layout>
  ```
- `phonara:focus-trade` 리스너: `moreRef.open()` + `betRef.focusAmount()` + scrollIntoView
- `?focus=bet` 쿼리도 동일 처리
- `HubTabs` 는 Hero 위가 아닌 MoreSection 내부 또는 sticky 컴팩트 한 줄로

### A3. 라우팅
- `TradingEntryCard` LONG/SHORT 버튼 → `/arena?side=long|short`
- `/arena` 기존 라우트 (`TradingArenaBybit` 또는 `TradingArenaWithArmy`) 확인 필요. 없으면 가장 가까운 트레이딩 페이지로 alias 추가.

---

## PART B — Ghost Empire 15,000명 튜닝

### B1. DB 설정 변경 (마이그레이션)
```sql
update bot_settings set
  online_base = 15000,
  strength_pct = 100,            -- 분당 활동 60개 ≈ strength*1.2*phase_mult
  bot_ratio_phase = 1            -- mult 1.0
where id = 1;
```
- `useOnline()` 의 `useJitter(base, { min:-8, max:14, every:4000 })` → 12,000~18,000 자연 범위 보장 위해 변동폭 확대: 신규 컴포넌트에서는 `min:-1500, max:1500, every:6000` 옵션으로 호출하거나, 새 RPC `get_bot_online_count` 가 base 그대로 반환하면 충분. **변경 포인트**: `LiveStats.tsx` `useOnline` 의 jitter 범위를 base 기반 비율(±10%)로 보정.
- `get_bot_online_count` RPC 본문이 base 외에 추가 가공이 있는지 확인 (필요 시 마이그레이션으로 base 그대로 반환하도록 단순화).

### B2. 활동 이벤트 발생률 60/min
- `bot-seed-engine` 의 `N = round((strength/100) * 120 * mult)` → strength=100, mult=1 → 분당 120 row 삽입
- 분당 50~70 목표 → 공식 변경: `120` → `60` 으로 줄이거나 strength=50 유지. **선택**: 공식을 `60`으로 바꾸고 strength=100 유지 (관리자 슬라이더로 향후 ±조절).
- `expires_at`는 기존 그대로 (현재 정책 유지 — 만료 자동 삭제).
- 가짜 티 방지: 이벤트 reward/타입 가중치는 그대로, 시간 offset도 0~60s 분산 유지.

### B3. Realtime 브로드캐스트
- `bot_activity_events` 테이블이 이미 존재하고 INSERT 트리거가 있는 경우 → realtime publication 여부만 점검. 없으면 `ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_activity_events;` 추가 (마이그레이션).
- `<ActivityEventTicker />` 가 해당 채널 구독:
  ```ts
  supabase.channel('ghost-feed')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bot_activity_events'}, push)
    .subscribe()
  ```
- realtime 미가용 시 클라 fallback (random pool) 자동 사용.

### B4. 마스킹 닉네임 RPC (선택, 권장)
- 기존 `bot_personas.nickname` 노출이 부담스러우면 `mask_nickname()` 헬퍼: 첫 글자 + `***`. 클라에서 처리(서버 변경 불필요).

### B5. /guide?tab=starter 동기화
- `StarterFunnelV3` Scene 3 의 라이브 피드를 `<ActivityEventTicker variant="hero" />` 로 교체 → 대시보드와 동일 소스/숫자.
- "15,XXX명 제국에 입성 중 · SIMULATION ACTIVE" 배지 추가 (`useOnline()` 사용).

### B6. Edge Function Secret 점검
- 현재 로그에 `[bot-seed-engine] BOT_CRON_SECRET is not configured` 반복 → cron이 실패 중. 마이그레이션 + 코드와 별도로, **사용자에게 `BOT_CRON_SECRET` secret 추가 요청 필요** (secrets 도구). cron job(`pg_cron`) 호출 헤더와 매치 필요.

---

## PART C — 검증

- 빌드 통과 (자동)
- `/command` 첫 페인트: Hero 100vh 단일 화면, 스크롤 없이 CTA만 보이는지
- CTA 클릭 → MoreSection 자동 펼침 + 베팅 패널 포커스 + scrollIntoView 동작
- LONG/SHORT 클릭 → `/arena?side=long|short` 이동
- KPI 4개 카드 외 above-the-fold에 다른 카드 노출 없음
- `/guide?tab=starter` Scene 3 피드가 대시보드와 동일 카운트/이벤트
- 모바일(현재 viewport 1180 데스크톱 + 360 모바일) 둘 다 60fps 유지, 발열 없음
- `useOnline()` 가 12,000~18,000 사이 자연 변동
- `bot_activity_events` 분당 50~70 row INSERT 확인 (`select count(*) from bot_activity_events where occurred_at > now() - interval '1 minute'`)

---

## 변경 파일 요약

신규
- `src/components/dashboard/v3/DashboardHeroV3.tsx`
- `src/components/dashboard/v3/TradingEntryCard.tsx`
- `src/components/dashboard/v3/KpiGridV3.tsx`
- `src/components/dashboard/v3/MoreSection.tsx`
- `src/components/dashboard/v3/ActivityEventTicker.tsx`

수정
- `src/pages/Dashboard.tsx` (대규모 정리)
- `src/components/LiveStats.tsx` (`useOnline` jitter 범위 ±10% 비율화)
- `src/components/guide/StarterFunnelV3.tsx` (Scene 3 ticker 통합)
- `supabase/functions/bot-seed-engine/index.ts` (분당 60 이벤트 공식)

마이그레이션
- `bot_settings` update (online_base=15000, strength_pct=100)
- `ALTER PUBLICATION supabase_realtime ADD TABLE bot_activity_events;` (이미 등록 시 무동작)

Secret 요청 (사용자 확인)
- `BOT_CRON_SECRET` (현재 미설정 → cron 실패 중)

---

완료 시 두 메시지 모두 보고:
- "**대시보드 우주 끝판왕 V3 완료**"
- "**Ghost Empire Simulation 15,000명 설정 완료**"
