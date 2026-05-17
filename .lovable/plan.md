# 게임화(Gamification) 대폭 도입 — Pass 1

기존 자산을 최대한 재사용하고, money-flow / Operator Isolation / Bundle Budget / Realtime Partition / Active Governor는 단 1바이트도 건드리지 않습니다.

## 기존 자산 (재사용)

- `achievements_catalog` (60개), `user_achievements` — 업적 시스템 골격 존재
- `badges_catalog` (33개), `user_badges` — 배지 시스템 골격 존재 (Bronze/Silver/Gold/Legendary tier)
- `empire_levels` + `recompute_empire_level` — Empire 레벨 (유지, 미변경)
- `claim_daily_attendance_v2` — 7일 스트릭 (유지)
- `award_crown`, `enqueue_fomo_notification` — Warm King 알림 인프라

## 신규 작업

### 1. PHON 레벨 시스템 (1~100)

신규 테이블:
- `phon_levels(user_id PK, level int, xp bigint, total_xp bigint, updated_at)`
- `phon_level_events(id, user_id, kind, xp_delta, source_ref, created_at)` — 감사 로그
- `phon_level_rewards_claimed(user_id, level, claimed_at)` — 레벨업 보너스 1회 지급 보장

XP 공식 (클라이언트 + 서버 미러):
- level N → next: `floor(100 * 1.15^(N-1))` XP 필요 (1→2: 100, 50→51: ~108k, 100 cap)

신규 RPC (SECURITY DEFINER + `auth.uid()` 가드):
- `grant_phon_xp(_kind text, _xp bigint, _source_ref text)` — XP 가산, 레벨업 시 `phon_level_events` + `enqueue_fomo_notification('level_up')` + 레벨×1000 PHON 보너스 + 10레벨마다 24h Empire Booster (`empire_boosters` 재사용)
- `get_my_phon_level()` → `{level, xp, xp_to_next, total_xp}`
- `claim_phon_level_reward(_level int)` — 멱등 (UNIQUE user_id+level)

XP 적립 소스 (트리거 추가 — money-flow 미터치):
- `user_achievements` AFTER INSERT → `grant_phon_xp('achievement', catalog.ap*10, key)`
- `streak_milestones` AFTER INSERT → `grant_phon_xp('streak', day*50, ...)`
- 출금/입금/베팅 등 money-flow 경로는 **건드리지 않음** (필요 시 별도 Pass 2)

### 2. 업적 30개 큐레이션

`achievements_catalog`는 이미 60개. 사용자 요청 30개 핵심 업적을 카탈로그에 **존재하는지 확인 후 upsert** (insert tool):
- `first_withdrawal`, `streak_7`, `streak_30`, `earn_1m_phon`, `founding_seat`, `staking_100k`, `trade_50pct_gain`, `first_deposit`, `daily_chest_30`, `phon_level_10/25/50/100`, `badge_collector_10`, `achievement_15`, `vip_subscribed`, `crown_war_winner` 등 30종.
- 각 업적 `badge_tier` 채워 자동 배지 지급 (기존 `trg_user_achievement_is` 활용).

### 3. 일일 보상 상자 (Daily Chest)

신규 테이블:
- `daily_chest_opens(user_id, opened_date PK, streak_day int, tier text, payload jsonb, opened_at)`

보상 풀 (상수 `DAILY_CHEST_REWARDS`, 서버 권위):
- Bronze (1~2일): 500~2000 PHON + 50 XP
- Silver (3~6일): 2000~6000 PHON + 150 XP + 가끔 무료 베팅권 1매
- Gold (7~13일): 6000~15000 PHON + 400 XP + Empire Booster 6h 5%
- Legendary (14일+): 15000~50000 PHON + 1000 XP + Empire Booster 24h 25% + Crown 가능성

신규 RPC:
- `open_daily_chest()` — 오늘 미오픈 시 attendance_streak 기반 tier 결정 → 랜덤 페이로드 → PHON/XP/booster 지급 + `enqueue_fomo_notification('chest_legendary')` (Legendary 시)
- `get_daily_chest_state()` → `{can_open, streak_day, tier_preview, last_opened_at}`

### 4. 프론트엔드

신규 컴포넌트 (`@/components/gamification/`):
- `LevelProgressBar.tsx` — PHON 레벨 + XP 게이지 (Warm King 그라디언트)
- `DailyChest.tsx` — Dashboard 마운트, 클릭 시 오픈 애니메이션 (framer-motion `scale + glow`)
- `AchievementCard.tsx` — 잠금/해제 상태, AP/배지 tier 표시
- `BadgeCollection.tsx` — 프로필 그리드 (tier 색상 칩)
- `LevelUpToast.tsx` — 레벨업 시 전역 알림 (zustand store)

신규 훅 (`src/hooks/`):
- `use-phon-level.ts` (`useLevel`) — `get_my_phon_level` + Realtime on `phon_levels` (wallet 파티션 재사용 X — 별도 `gamification:phon_levels` 채널은 wallet wrapper 통해)
- `use-daily-chest.ts` (`useDailyChest`)
- `use-achievement.ts` (`useAchievement`) — 기존 `use-achievement-watcher`와 충돌 없이 read-only 조회 훅으로

신규 상수 (`src/lib/gamification.ts`):
- `ACHIEVEMENT_LIST`, `STREAK_MILESTONE_DAYS`, `DAILY_CHEST_REWARDS`, `PHON_LEVEL_XP_FORMULA`

페이지 통합:
- `Dashboard.tsx`: `<DailyChest />` + `<LevelProgressBar />` 상단 추가
- `/profile` 또는 `/empire/my-seat` 근처: `<BadgeCollection />` + PHON 레벨 + Empire 레벨 동시 표시
- `/achievements`: 기존 페이지에 카테고리 필터 + `AchievementCard` 적용

### 5. Warm King 톤

`docs/conventions/naming.md` 준수:
- 레벨업: "👑 폐하의 위엄이 한 단계 더 깊어졌습니다 (Lv {N})"
- 상자 Legendary: "🎁 전설의 보물상자가 폐하 앞에 놓였습니다"
- 업적 해제: "🏆 새로운 업적 — {name}"

## 절대 불변 검증

- `node scripts/check-money-flow-freeze.mjs` — git diff = 0
- `node scripts/check-operator-isolation.mjs` — PASS
- `npm run size:check` — 신규 컴포넌트 lazy import로 index/dashboard 청크 예산 유지
- Realtime: 신규 채널은 `useWalletChannel` (wallet 파티션) 재사용, raw `supabase.channel` 금지

## 작업 순서

1. 마이그레이션 1개: 테이블 4개 + RPC 6개 + 트리거 2개 + RLS
2. insert 호출 1개: `achievements_catalog` 30개 upsert + `DAILY_CHEST_REWARDS` 시드 (필요 시)
3. 상수/훅/컴포넌트 작성 (병렬)
4. Dashboard / Profile / Achievements 페이지 통합
5. 검증 3종 + 타입 재생성
