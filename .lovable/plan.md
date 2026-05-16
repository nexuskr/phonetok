# PHONARA.WORLD — The Only Digital World You'll Ever Need

**Trump × Musk Edition · 통합 마스터 플랜 v1.0**

---

## 0. 한 줄

> "현실보다 더 재미있고, 더 돈이 되고, 더 소속감 있는 제2의 인생."
> 한국 점령(6개월) → 아시아 패권(18개월) → 글로벌 독점(36개월).

**측정 가능한 1년 목표:** DAU 5×, 평균 세션 18→45분, D7 리텐션 25%+, ARPPU 3×.

---

## 1. 포지셔닝 (Phase별)

| Phase | 기간 | 포지셔닝 | 환급 |
|---|---|---|---|
| **1 한국 점령** | 0~6M | PHON 기반 하이브리드 소셜카지노 + Earn 허브 | 상품권/NFT/포인트 + 코인 |
| **2 아시아 패권** | 6~18M | 가상 국가 (아바타·길드·메타) | + 라이선스 기반 직접 환급 |
| **3 글로벌 독점** | 18M+ | "The Digital World" | USDT 직접 베팅 + 글로벌 환급 |

기존 자산(Empire 10티어 · VIP Pass · Founding Seats · Crown War · Whale Strike · NFT 부스트 · Trust v2 · AI Coach · Oracle Fortress · Reactivation)은 **전부 보존**하고 그 위에 Earn Hub + 환전 + 중독 루프를 얹는다.

---

## 2. 지갑·경제 구조 (전면 재설계)

```text
[Deposit Balance]   USDT / 계좌이체 / 상품권   ── 입금 원장 (출금 대상)
        │  (사용자 선택 환전 — 0% fee)
        ▼
[PHON Balance]      게임 · 트레이딩 · Earn 사용
        │  (출금 시 1.5%, VIP 면제)
        ▼
[Withdraw]          코인 / 상품권 / NFT
```

- **기본 환율:** 1 USDT = 1,300 PHON (기존 유지, 메모 준수)
- **VIP 보너스 환전:** Silver +2% / Gold +5% / Platinum +8~10% PHON 추가 지급
- **한정 이벤트:** "오늘만 1:1,450 PHON" FOMO 배너 (주 1~2회)
- **자동 환전 옵션:** 입금 시 30/50/100% 선택, 미선택 시 Deposit Balance 유지
- **보안:** 환전 전 30초 카운트다운 + 2FA + 일일 한도 + AI 이상탐지(`anomaly_events` 재활용)

---

## 3. 6주 1차 스프린트 (즉시 실행)

### Week 1 — Earn Hub MVP (`/earn`)
- 라우트 + 좌측 사이드바 🎁 진입
- 5카드: **일일출석 · 일일미션 · 친구초대 · Play-to-Earn · 주간보스**
- D1=100 → D7=1,000 PHON + 슬롯 프리스핀 10
- 미션 5종 자동 롤(슬롯 50스핀/크래쉬 3판/초대/채팅/트레이딩)
- 친구 초대 2단(가입 +200, 첫 입금 양쪽 +1,500)
- Play-to-Earn: 누적 10k PHON 베팅마다 100 PHON 보너스 크레딧(베팅 전용)
- AI Coach를 Earn 일일 브리핑 카드로 재배치

### Week 2 — 듀얼 지갑 + 선택적 환전
- `wallet_balances`에 `deposit_balance` 컬럼 + PHON 분리
- RPC: `convert_deposit_to_phon(amount, auto_pct?)` / `revert_phon_to_deposit(amount)`
- 신규 페이지: `/wallet` 탭 "환전" + 30초 카운트다운 + VIP 보너스 표시
- 입금 플로우 변경: 입금 완료 → "자동 환전 비율 선택" 다이얼로그
- "오늘만 ×1.12 환전" 한정 배너 인프라(`fx_rate_promos` 테이블)

### Week 3 — 중독 코어 루프 극한 강화 (전 게임)
- **빅윈 3단계 연출:** Mega(10×) / Epic(50×) / Legendary(100×) 풀스크린 + 화면 흔들림 + 사운드 빌드업 + 햅틱
- **Hot Streak:** 3연승 시 오버레이 + 다음 스핀 1.2× 멀티
- **니어미스 강화:** 스캐터 2개 + 3번째 reel 0.5초 지연
- **콤보 메터:** 5스핀 누적 → 보너스 트리거 확률 +5%
- **크래쉬:** 라이브 채팅 + 베팅 마키(현 라운드 베팅자 닉네임 흘림) + 사운드 빌드업
- **룰렛 일일 무료 1회:** Earn에서 클레임, 잭팟 0.1% 떡밥
- **세션 종료 방지:** 5분 비활동 시 "🔥 잭팟 임박" 토스트 (실데이터)

### Week 4 — 세계관 통합 ("Phonara World")
- Stake 스타일 다크 + 골드 리디자인, 좌측 영구 사이드바
  - Casino / Crash / Roulette / Trading / **Earn** / Empire / Lounge
- 상단 라이브 티커: Whale Strike + VIP 입장 + 최근 출금 한 줄 (기존 RPC 재활용)
- 60초 온보딩: 가입 → 무료 룰렛 → 일일미션 1개 → 슬롯 데모 → 패키지 추천
- 화면 진입 시그니처 사운드(음소거 가능)

### Week 5 — VIP 시스템 강화 + 소셜 기본
- VIP Empire Pass 3티어(Silver/Gold/Platinum) — 환전 보너스 + 수수료 면제 + 전용 라운지
- 글로벌 채팅 강화: 빅윈 자동 브로드캐스트 + 이모지 리액션
- 친구 시스템: 추가 / 빅윈 알림 / 친구 랭킹
- 한정 이벤트: 주말 더블 보상 / 한정 환율 / VIP-only 토너먼트

### Week 6 — 데이터·폴리시·푸시
- `/admin/kpi` 신규 패널: D1/D7/D30 리텐션 · Earn→실입금 전환 · 평균 세션 · ARPU · 환전량
- A/B 프레임워크: 빅윈 강도 / 온보딩 순서 / 미션 리워드
- PWA 푸시: 잭팟 임박 / 친구 빅윈 / 일일미션 리셋 / 한정 환전
- TikTok형 빅윈 피드(PersonalizedFeedRail 풀스크린 모드)
- QA 스윕 + 첫 6주 회고

---

## 4. Phase 2 (M6~M18) — 아시아 패권

- **Crash Game** 자체 엔진 출시 (Oracle Fortress 가격 합의 재활용)
- **아바타 시스템** (NFT 부스트 시각화 + 라운지 룸)
- **길드 v2** (실시간 보이스 채팅 + 길드 토너먼트 + 길드 환전 풀)
- **TikTok 스타일 풀스크린 피드** 메인 진입점화
- **AI 개인화 추천** (V17 엔진 확장, 게임/시간대/금액 추천)
- **i18n:** 영어 → 일본어 → 베트남어 → 중국어(번체)

## 5. Phase 3 (M18+) — 글로벌 독점

- Curacao/Anjouan **라이선스 취득** + 법인 분리
- **USDT 직접 베팅** (PHON 우회 옵션) — 글로벌 전용
- **자체 게임 5종** 추가 출시
- **대규모 가상 이벤트:** 콘서트 / 토너먼트 / 페스티벌 (1만명+ 동시 접속)
- **Phonara 경제권:** 광고주·크리에이터·B2B 시뮬 API(`sim-api` 이미 가동 중)

---

## 6. 수익 모델 (Phase 1 기준)

| 라인 | 비중 | 메커니즘 |
|---|---|---|
| 게임 하우스엣지 | 50~55% | 슬롯 RTP 96% · 크래쉬 1% · 룰렛 2.7% |
| PHON 패키지 + VIP | 28~32% | 첫입금 보너스 + 한정 환율 + 3티어 구독 |
| 오퍼월/광고 | 12~15% | AdGate/OfferToro SDK (Week 5에 secret 추가) |
| 트레이딩 수수료 | <5% | Phase 2 확대 |

---

## 7. 기술 사항 (개발 참조)

### 신규 라우트
- `src/pages/Earn.tsx`
- `src/pages/PhonaraWorld.tsx` (메인 리디자인, Index 병행 → 점진 교체)

### 신규 테이블 (migration)
- `daily_login_streaks` (user_id, current_streak, last_claim_at, total_claimed)
- `daily_missions` (id, user_id, mission_code, progress, target, claimed_at, expires_at)
- `play_to_earn_ledger` (user_id, total_wagered_phon, bonus_credit_balance)
- `referral_rewards` (referrer_id, referee_id, signup_reward_at, deposit_reward_at)
- `offerwall_completions` (user_id, provider, offer_id, payout_phon, status)
- `fx_conversions` (user_id, deposit_amount, phon_credited, fx_rate, vip_bonus_pct, fee_pct)
- `fx_rate_promos` (id, label, multiplier, starts_at, ends_at, active)
- `wallet_balances` 확장: `+ deposit_balance numeric`

### 신규 RPC
- `claim_daily_streak()`
- `roll_daily_missions()` (cron 매일 00:00 KST)
- `claim_mission(mission_id)`
- `process_referral_deposit(referee_id)` (입금 트리거)
- `credit_play_to_earn(user_id, wagered)` (베팅 RPC 내부)
- `convert_deposit_to_phon(_amount, _confirm_token)` — 30초 confirm token
- `revert_phon_to_deposit(_amount)`
- `get_current_fx_promo()` — 한정 배너용 공개 RPC

### 재활용 (변경 없음)
Whale Strike Rail · VIP Arrivals · Reactivation · Trust v2 · NFT Boost · AI Coach · Empire 10티어 · Founding Seats · Crown War · Oracle Fortress · Kernel Observability · sim-api

### 디자인 토큰
- 다크 베이스 `#0B0E1A` + 골드 `#F0B935` + 액센트 핫핑크 `#FF3B7C`
- 폰트: Pretendard(한글) + Space Grotesk(영문)
- 모든 카드: 그라디언트 보더 + 펄스 글로우 (Stake/롤빛 톤)

### 결제 제약 (메모 준수)
코인 입금 + 한국 계좌이체 + 상품권 수동. Stripe/PG 자동 제안 금지.

---

## 8. 실행 원칙 (Trump × Musk)

**Musk — First Principles:**
1. 6주마다 큰 업데이트 + 사내 데모 데이
2. 모든 의사결정은 `/admin/kpi` 숫자 기준
3. 수직 통합(Earn·게임·소셜·경제·NFT 전부 자체 제어)

**Trump — Bigger Than Everyone:**
1. 매주 1회 한정 이벤트 / FOMO 배너
2. VIP는 과감하게 차별 대우(전용 라운지·환전 보너스·수수료 0%)
3. "세계 최고" 메시지 일관 노출 — Whale Strike Rail / VIP Arrivals 항상 ON

---

## 9. 6주 성공 기준

| 지표 | 현재 추정 | 6주 목표 |
|---|---|---|
| D1 리텐션 | ~30% | 55%+ |
| D7 리텐션 | ~10% | 25%+ |
| 평균 세션 | ~5분 | 18분+ |
| Earn→실입금 전환 | N/A | 8%+ |
| DAU | 기준선 | 5× |
| 환전 사용률 | N/A | 입금자 70%+ |

---

## 10. 다음 액션

승인 시 **Week 1 (Earn Hub MVP) 즉시 착수**. 1주 단위로 보고 + 다음 주 우선순위 재확인. Phase 2/3 세부 플랜은 Week 6 회고 시점에 v2로 갱신.
