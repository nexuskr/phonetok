# 🔥 PHONARA — 4-Pillar 통합 엔진 (확정판)

핵심 4기둥만 살린다. 군더더기 없이 Phase 0 단일 마이그 + 단일 HUD + 4개 결합 지점.

---

## 1. 4-Pillar (확정 · 변경 없음)

### Pillar 1 — IMPERIAL SCORE (IS)
모든 시스템의 단일 점수. 미션·퀘스트·업적·트레이딩·결제가 전부 여기에 누적.

| 출처 | IS 획득 (기본) |
|---|---|
| 미션 1개 | +1 × 미션 티어 부스트 (NORMAL 1× / VIP 1.5× / GOD 2.5× / EMPIRE 4×) |
| 퀘스트 1개 | +5 |
| 업적 1개 | AP 값을 그대로 IS로 흡수 |
| 트레이딩 +1% PnL | +10 |
| 잭팟 1회 시도 | +0.5 |
| **결제 ₩10,000** | **+30** |

소스별 일일 캡: mission=1000 · quest=300 · achievement=500 · trading=∞ · deposit=∞.

### Pillar 2 — DEPOSIT BOOSTER WINDOW
결제 시점부터 24시간 폭발 구간. 추가 결제 시 +24h 누적, 최대 168h(7일).

| 효과 | 배수 |
|---|---|
| 미션 보상 | ×2 |
| 퀘스트 보상 | ×2 |
| 업적 AP | ×1.5 |
| 트레이딩 PnL 보너스 | ×1.5 |
| 잭팟 확률 | ×2 |
| IS 획득 | ×2 |

만료 = 절벽 → 재입금 동기.

### Pillar 3 — ESCALATION LADDER
입금 누적이 다음 시스템을 잠금 해제. 24h(today) / lifetime 명확 구분.

```text
₩29K     → NORMAL 미션 풀 + Bronze 뱃지
₩100K    → VIP 미션 + 시즌패스 ×2 트랙 + Silver
₩1M      → GOD 미션 + Private Pool + 트레이딩 레버 ×2 + Gold
₩10M     → EMPIRE 미션 + 1:1 매니저 + Empire Day 자동 + Diamond
₩50M/24h → PHANTOM Syndicate 자문석 + Mythic + 영구 보존
₩100M/24h → "황제 좌석" 일 1명 + 1억 잭팟 추첨권
₩500M/24h → "전설" 명예의 전당 영구 + 5억 잭팟 추첨권
₩1B/24h  → "DEUS" 단 1명 — 영구 1순위 출금 + 30% 자동 매칭 + 평생 PHANTOM
```

### Pillar 4 — TRADING ↔ DEPOSIT 연결
Paper 포지션 한도 = **24h 누적 입금 × 10**.
- 입금 ₩100K → 포지션 ₩1M
- 입금 ₩10M → 포지션 ₩100M
- 입금 ₩1B → 포지션 ₩100억 (SIM)

큰 포지션 = 큰 PnL = 큰 IS·잭팟·리더보드 폭발. SIM 라벨 유지.

---

## 2. 통합 흐름 한 장

```text
[결제 (코인/계좌/상품권)]
         │
   ┌─────┼─────┐
   ▼     ▼     ▼
BOOSTER  LADDER  IS+30/만원
  24h    진척    
   │     │     │
   ▼     ▼     ▼
미션×2 퀘스트×2 업적×1.5 트레이딩×1.5/한도×10 잭팟×2
   │     │     │     │     │
   └─────┴──IS──┴─────┴─────┘
              │
              ▼
       WHALE LEADERBOARD (일별 Top 100)
              │
              ▼
       상위 → 다음 BOOSTER 5×
```

---

## 3. Phase 0 — 단일 마이그 + 단일 HUD

### A. 마이그레이션 (1개 파일)

**신규 테이블 6개**
- `imperial_scores` — user_id PK, total/daily/weekly/season_is, updated_at. RLS 본인 SELECT, system-only UPDATE
- `imperial_score_events` — id, user_id, source, delta, multiplier, created_at. RLS 본인 SELECT, admin 전체 (감사)
- `deposit_booster_windows` — id, user_id, started_at, expires_at, source_purchase_id, hours_accumulated. RLS 본인 SELECT
- `escalation_milestones_catalog` — key, threshold_krw, threshold_window(daily|lifetime), reward_json, sort_order. 공개 SELECT
- `user_escalation_progress` — user_id, milestone_key, reached_at, window_date. RLS 본인 SELECT + 공개 리더보드용 닉만
- `daily_whale_leaderboard` — date, user_id, deposit_total_krw, is_total, rank. 공개 SELECT (닉 마스킹)

**RPC 5개 (전부 SECURITY DEFINER · internal-only · `function_permissions_baseline` 등록)**
- `award_imperial_score(_user_id, _source text, _base_delta int)` — 부스터 자동 적용, 소스별 일일 캡 체크, `imperial_score_events` 기록
- `start_or_extend_booster(_user_id, _purchase_id, _hours)` — 신규 발동/누적 연장, 최대 168h
- `check_escalation(_user_id, _new_deposit_krw)` — 사다리 도달 체크, 뱃지 자동 부여(`user_badges`), 알림 enqueue
- `apply_booster_multipliers(_user_id, _base, _source) → numeric` — 미션/퀘스트/업적/트레이딩 정산이 공통 호출
- `get_my_dashboard_state()` → jsonb — IS·부스터 잔여·다음 사다리·일별 순위 단일 호출

**트리거 1개**
- `package_purchases` AFTER INSERT (status='confirmed'일 때):
  1. `award_imperial_score(user_id, 'deposit', krw/10000*30)`
  2. `start_or_extend_booster(user_id, purchase_id, 24)`
  3. `check_escalation(user_id, krw)`

### B. 결합 지점 4개 (정확히)

| 시스템 | 파일 | 변경 |
|---|---|---|
| 미션 | `src/lib/missions-rpc.ts` + 정산 RPC | 정산 후 `award_imperial_score('mission', reward/1000)` |
| 퀘스트 | `claim_quest` RPC | claim 후 `award_imperial_score('quest', 5)` |
| 업적 | 업적 해금 트리거/RPC | 해금 시 `award_imperial_score('achievement', ap)` |
| 트레이딩 | `enforce-position-triggers` 또는 PnL 정산 | 정산 시 `award_imperial_score('trading', floor(pnl_pct*10))` + 포지션 한도 = `24h_deposit*10` 강제 |
| 잭팟 | `Missions.tsx rollJackpot` | 시도당 +0.5 IS, 부스터 시 당첨 확률 ×2 |

### C. UI — 단일 HUD + 단일 페이지

**신규 파일 (5개)**
- `src/components/imperial/ImperialHud.tsx` — Layout 상단 고정. 현재 IS · 부스터 잔여시간 · 다음 사다리까지 ₩ · 오늘 순위. 디자인 토큰만.
- `src/components/imperial/BoosterPill.tsx` — "🔥 ×2 (13:22:15)" 알약. 미션/퀘스트/트레이딩/잭팟 카드 우상단에 끼움.
- `src/components/imperial/EscalationCallout.tsx` — "₩110K만 더 → GOD 미션 + 트레이딩 ×2" CTA 카드. 부족 금액 자동 계산.
- `src/pages/Whales.tsx` — `/whales` 일별 Top 100 + Realtime + 9등 추월 CTA.
- `src/hooks/use-imperial-state.ts` — `get_my_dashboard_state` + Realtime 구독.

**수정 파일 (8개)**
- `src/components/Layout.tsx` — `ImperialHud` 마운트
- `src/components/HubTabs.tsx` — `/whales` 탭 추가
- `src/App.tsx` — `/whales` 라우트
- `src/pages/Missions.tsx` — `BoosterPill` + 보상 표시에 부스터 적용
- `src/pages/Quests.tsx` — 동일
- `src/pages/Achievements.tsx` — AP → IS 표기 통합
- `src/pages/TradingArenaWithArmy.tsx` — 포지션 다이얼에 "한도 ₩XM (입금 +₩XK 시 +₩YM)"
- `src/pages/Packages.tsx` — 카드에 "구매 시 +N IS · 부스터 24h · 사다리 진척 X%" 라인

### D. Edge Functions (2개)
- `imperial-score-reconciler` (cron 5분) — 누락된 IS/booster 재계산 가드
- `whale-leaderboard-tick` (cron 1분) — 일별 Top 100 캐시 갱신, KST 자정 리셋

---

## 4. 보안·룰 (메모리 코어 준수)

- 신규 RPC 전부 SECURITY DEFINER + `function_permissions_baseline`에 internal-only 등록 → 클라이언트 직접 호출 금지
- `imperial_score_events`에 모든 변동 기록 → admin 감사 가능
- 부스터 최대 168h 캡 (영구 ×2 방지)
- 사다리 today 슬롯은 KST 자정 리셋 (`window_date` 컬럼)
- SIM 라벨 절대 유지 — IS·잭팟·리더보드·트레이딩 모두 SIM 표기
- profiles 민감 컬럼 직접 UPDATE 없음 — 모든 변경은 신규 RPC 경유
- UX 프리미티브: `EmptyState`/`LoadingList`/`@/lib/notify` 만, 디자인 토큰만, sonner 직접 호출 금지
- AAL2 출금·자동 동결·디바이스 핑거프린트 그대로 유지

---

## 5. 분석 이벤트 (`@/lib/analytics`)

- `imperial_score_awarded` { source, base, multiplier, total }
- `booster_started` / `booster_extended` { hours, expires_at }
- `escalation_unlocked` { milestone_key, window }
- `whale_rank_change` { from, to, delta_krw }
- `trading_position_capped` { requested, cap, deposit_24h }

---

## 6. Phase 1 (D+1~D+7) · Phase 2 (D+8~D+30)

**Phase 1**
- Empire Day(매월 1·15) 자동 ×2 → BOOSTER에 흡수
- Family Combo (가족 BOOSTER 1.2× 공유)
- Whale 뱃지 6종 (Bronze→Mythic) `badges_catalog` 추가
- `/protect` 사기방지 허브 + AI 진단 (`google/gemini-2.5-flash`) — 비입금자 유입 깔때기

**Phase 2**
- 시즌1 정식 (`seasons` 가동, IS = 시즌 점수)
- PHANTOM Syndicate 분기 라이브
- B2B 신뢰 API (사기방지 점수 외부 임베드, 수수료 수익)
- 인플루언서 50명 UGC, 광고비 점화

---

## 7. 선행 지표 (오픈 D+7 안에 확인)

- 일 EMPIRE(₩9.9M) 구매자 5명+
- 부스터 7일 풀 연장자 10명+
- 트레이딩 일평균 포지션 ₩100M+
- Whale Top 10 평균 입금 ₩50M+/일

위 4개가 보이기 시작하면 D+30~D+90 안에 일 ₩1B 입금자 도달 페이스.

---

## 8. 다음 액션

승인하면 단일 마이그(6테이블+5RPC+1트리거) → 5개 신규 파일 + 8개 수정 파일 + 2개 Edge Function 순차 착수.
빌드 후 `/whales` + `ImperialHud` + Packages 카드 즉시 동작 확인.
