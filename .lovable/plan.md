# Phase 24 (코어) + Phase 25 (인프라) — 끝판왕 로드맵

선택하신 두 트랙을 한 번에 진행합니다. 두 작업은 영역이 겹치지 않아 동시에 안전하게 적용할 수 있습니다.

---

## 🎮 Phase 26 — 게이미피케이션 (업적 / 배지 / 시즌 패스)

### 목표
사용자가 매일 다시 들어올 이유를 만든다. "수익만 내는 앱"에서 "수집·성장·과시하는 앱"으로 진화.

### A. 업적 (Achievements) 시스템
정적 카탈로그 60+ 업적, 트리거형 자동 해금.

| 카테고리 | 예시 |
|---|---|
| 미션 | 첫 승리 / 100승 / 1000승 / 10연승 / 30연승 |
| 자산 | 총 100만원 적립 / 1억 적립 / 첫 출금 / VIP/GOD/EMPIRE 승급 |
| 봇 | AI 봇 첫 클레임 / Trading Bot +25% 수익 / 100회 실행 |
| 룰렛·가챠 | 잭팟 당첨 / UR 가챠 / 골든 잭팟 |
| 소셜 | 친구 1·5·25명 초대 / 레퍼럴 수익 100만원 |
| 출석 | 7일·30일·100일 연속 출석 |

각 업적은 **포인트(AP)** + **보너스 크레딧** + **배지** 보상.

### B. 배지 (Badges) — 프로필 자랑 요소
- 프로필 / 채팅 / 리더보드에 띄울 **상위 3개 픽셀 배지** 슬롯
- 등급: Bronze / Silver / Gold / Platinum / Diamond / Mythic (시즌 한정)
- 시즌 한정 배지는 시즌 종료 후 영구 보존(과시용)

### C. 시즌 패스 (Battle Pass)
4주 단위 시즌, 50 레벨.

- **무료 트랙**: 모든 사용자, 5레벨마다 소액 보상
- **프리미엄 트랙**: Empire 자동 / VIP·GOD는 일정 가격에 구매 / 매 레벨 보상
- **XP 획득**: 미션 승리, 봇 클레임, 룰렛, 출석, 업적 해금
- **시즌 한정 보상**: 미식 배지, 프로필 테두리, 채팅 닉네임 색상, 보너스 크레딧, 잭팟 가챠 티켓

### D. 일일·주간 퀘스트
- 일일 3개 (예: "미션 5승", "봇 1회 클레임", "룰렛 1회") → XP + 소액 크레딧
- 주간 3개 → 큰 XP + 시즌 패스 가속

---

## ⚡ Phase 25 (인프라) — 성능 최적화

현재 `App.tsx`가 모든 페이지를 직접 import → 첫 진입 번들이 비대. AI 봇/룰렛/Admin/AdvancedAnalytics(Recharts) 등 무거운 화면이 모두 즉시 로드.

### A. 코드 스플리팅
- `App.tsx` 전 라우트를 `React.lazy()` + `<Suspense>`로 분할
- Admin, AdvancedAnalytics, Roulette, AIBot, FloatingChat, Profile 등 **무거운 청크 우선 분리**
- Recharts는 Admin 청크 안에만 들어가도록 정리 (다른 페이지 누수 차단)
- vite `manualChunks`로 vendor 분리 (react / supabase / recharts / framer-motion / radix-ui)
- 라우트 전환 시 부드러운 글로벌 로딩 스피너 (Cyber Luxury 톤)

### B. React Query 캐싱 강화
- 글로벌 `staleTime` 30s, `gcTime` 5min 기본값
- 지갑 잔액 / 미션 / 리더보드 등 자주 조회되는 쿼리 키 정리 + 적절한 invalidation
- Realtime 구독은 채팅·실시간 알림에만 한정 (불필요한 폴링 제거)

### C. 이미지 최적화
- `src/assets/` 내 PNG 중 1KB↑인 것들 → WebP 또는 AVIF 변환 + import 갱신
- `<img loading="lazy" decoding="async">` 일괄 적용 (히어로 제외)
- 봇 카드 / 가챠 / 룰렛 아이콘 등 장식용 이미지 `decoding="async"`

### D. 기타 잔탈
- `prefers-reduced-motion` 존중 (배경 애니메이션 끄기)
- Lighthouse / `browser--performance_profile`로 LCP, TBT 측정 → before/after 보고

---

## 기술 설계 (요약)

### DB 마이그레이션 (Phase 26)
```text
achievements_catalog       정적 정의 (id, key, name, desc, category, ap, reward_credit, badge_tier, hidden)
user_achievements          (user_id, achievement_key, unlocked_at, claimed_at)
badges_catalog             (id, key, name, tier, season_id, icon_path)
user_badges                (user_id, badge_key, equipped_slot 0..2)
seasons                    (id, name, starts_at, ends_at, max_level)
season_pass_progress       (user_id, season_id, xp, level, premium boolean)
season_pass_rewards        (season_id, level, free_reward jsonb, premium_reward jsonb)
quests_daily / quests_weekly  (user_id, quest_key, period_key, progress, target, claimed)
```

### RPC
- `award_xp(_amount, _source jsonb)` — XP 적립 + 레벨업 + 보상 자동 지급
- `unlock_achievement(_key)` — 중복 방지, 보상 지급, 배지 발급
- `claim_quest(_quest_key)` — 검증 + 보상
- `equip_badge(_badge_key, _slot)` — 슬롯 0~2
- `purchase_season_pass()` — 가격 차감 후 premium=true
- `get_season_overview()` — 현재 시즌 + 내 진행도 + 상위 50 리더보드

### 자동 트리거 통합
`settle_mission`, `claim_ai_bot_run`, `spin_roulette`, `gacha_pull`, `apply_referral_code`, `claim_daily_attendance` 마지막에 `award_xp(...)` + 조건부 `unlock_achievement(...)` 호출 추가.

### 프론트 (Phase 26)
```text
src/pages/Achievements.tsx        카테고리 탭, 진행도 바, 자랑 모드
src/pages/SeasonPass.tsx          50칸 트랙 + 보상 카드 + 구매 모달
src/pages/Quests.tsx              일일·주간 + 카운트다운
src/components/BadgeShelf.tsx     프로필/채팅에 임베드
src/components/XPGainToast.tsx    XP 획득 글로벌 토스트
src/components/LevelUpModal.tsx   레벨업 시 풀스크린 연출
```

### 프론트 (Phase 25)
```text
src/App.tsx                  lazy + Suspense
src/components/RouteFallback.tsx   브랜드 톤 로딩 화면
vite.config.ts               manualChunks
src/lib/queryClient.ts       기본 캐시 정책
```

### Dashboard 통합
- "내 시즌 진행도" 카드 (레벨 / 다음 보상 미리보기 / XP 바)
- "오늘의 퀘스트 3개" 위젯
- 새로 해금된 업적 알림 배지

---

## 작업 순서
1. **Phase 25 인프라 먼저** — 라우트 lazy 분리 + queryClient + vite chunks (즉시 체감 ↑, 이후 작업도 빨라짐)
2. **Phase 26 DB & RPC** — 카탈로그 시드 포함
3. **Phase 26 프론트 페이지 3종 + 배지 슬롯**
4. **Dashboard 통합 & 트리거 RPC 연결**
5. **이미지 WebP 변환 + lazy loading 일괄**
6. **성능 측정 보고서 (전/후 LCP·TBT)**

전부 "Cyber Luxury" 톤 유지, 모든 색상은 `index.css` 디자인 토큰 사용.
