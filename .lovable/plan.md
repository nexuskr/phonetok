## v5.1 최종 플랜 — 차등 부스트 + Easy 150 매출 강화

### 변경점 (vs v5)
1. **Day 1~3 부스트 차등화**: Easy 라인 **+30%**, Empire **+50%**
2. **Easy 150 일수익 47,000원** (기존 42k → +5k)

---

### 1. 패키지 라인 (수치 최종 확정)

| 패키지 | 가격 | 일수익 | Day1~3 부스트 | 기간 | 총지급 | 마진 |
|---|---|---|---|---|---|---|
| Easy Starter | 79,000 | 2,500 | +30% → 3,250 | 30일 | 77,250 | **+1,750** |
| Easy 50 | 490,000 | 14,000 | +30% → 18,200 | 30일 | 432,600 | **+57,400** |
| Easy 150 | 1,490,000 | **47,000** | +30% → 61,100 | 30일 | 1,452,300 | **+37,700** |
| **Empire** | 9,900,000 | 280,000 | +50% → 420,000 | 30일 | 8,820,000 + 보너스 1,100,000 = **9,920,000** | **-20,000** (앵커) |

**계산식**: 총지급 = 일수익 × 27 + 부스트일수익 × 3.

⚠️ Easy 150 마진이 +37k로 줄어든 이유: 일수익 47k × 부스트 1.3 × 3일 = 부스트 가산분만 +16,500 × 3 = +49,500 추가 부담. 광고 임팩트(첫날 ₩61,100)는 강력하지만 마진은 Easy 50보다 낮아짐.

→ **권고**: Easy 150 부스트만 +20%로 미세 조정하면 마진 +97k 회복 가능. 결정 보류 항목.

---

### 2. UX 카피 (차등 노출)

**Easy 카드**:
> 🔥 오늘 시작 시 · 첫 3일 보너스 구간
> Day 1 ₩61,100 / Day 2 ₩61,100 / Day 3 ₩61,100

**Empire 카드** (+50% 강조):
> 🔥👑 Empire 전용 · 첫 3일 최대 가속 구간
> Day 1 ₩420,000 / Day 2 ₩420,000 / Day 3 ₩420,000
> "다음 Empire Day까지 D-3 · Founding 좌석 17석 남음"

---

### 3. DB 변경

**`package_purchases` 추가 컬럼**:
- `boost_until` timestamp
- `boost_multiplier` numeric default 1.3 — Empire는 1.5
- `seven_day_bonus_paid`, `instant_300k_paid`, `founding_bonus_paid` boolean
- `is_empire_founding_member` boolean, `founding_seat_no` int

**신규 테이블**:
- `empire_founding_seats` (id 1~30, claimed_by, claimed_at) — `SELECT FOR UPDATE`
- `boost_schedule` (date, multiplier) — Empire Day 사전 등록

**RPC**:
- `harvest_machine` 수정 — `now() < boost_until` 시 `daily_return × boost_multiplier`. Empire + boost_schedule 매칭 시 ×1.5.
- `approve_package_purchase` 수정 — 승인 시 `boost_until = approved_at + 3 days`, `boost_multiplier` 패키지별 설정. Empire면 좌석 시도 + 즉시 30만 + 좌석 50만.
- `claim_founding_seat`, `check_seven_day_challenge`, `get_empire_seats_remaining`, `get_active_boost_count`.

---

### 4. UI 파일 변경

**신규**:
- `src/components/BoostHeroCard.tsx` — Dashboard 상단, 부스트 카운트다운 + 수확
- `src/components/PackageBoostPreview.tsx` — Packages 카드 "오늘 시작 시" 블록 (배수 prop)
- `src/components/ActiveBoostCounter.tsx` — "지금 N명 부스트 중" 실시간
- `src/pages/Empire.tsx` — Founding 라운지
- `src/components/EmpireFoundingCounter.tsx` — 30석 실시간
- `src/components/EmpireDayCountdown.tsx` — 다음 Empire Day D-N
- `src/components/SevenDayChallengeCard.tsx` — 보조 카드

**수정**:
- `src/lib/store.ts` — PACKAGES 4종 + 패키지별 `boostMultiplier` 필드
- `src/pages/Packages.tsx` — Boost 미리보기(차등) + 카운터
- `src/pages/Dashboard.tsx` — BoostHero 메인, 잭팟·콤보 강등
- `src/pages/Wallet.tsx` — 보너스 항목 분리 표시
- `src/App.tsx` + `src/components/Layout.tsx` — `/empire` 라우트 (Founding gate)

**제거/숨김**: 마일스톤 UI 미구현, Dashboard 잭팟 메인 배너 → 수확 모달 내부로.

---

### 5. UX 카피 규칙 (위반 금지)

| ❌ 죽는 카피 | ✅ 살아나는 카피 |
|---|---|
| "Day 1~3 +30% 부스트" | "🔥 지금 초기 수익 구간 진입 · 23:14:22 남음" |
| "Empire +50% 적용" | "👑 Empire 전용 최대 가속 · 다른 등급에 없음" |

---

### 6. 보조 요소 (숨김)

- **7일 챌린지**: Dashboard 두 번째 카드, 진행도만. 달성 시 자동 1일치 추가.
- **Empire Day**: 월 1일/15일 자동 +50%. Empire 보유자 한정 카운트다운.
- **잭팟**: 수확 직후 모달 연출에서만.
- **콤보 UI**: 시각만, 금액 불변.

---

### 7. 법적 안전장치

- "30일 한정 확정 적립률 / 일별 적립 스케줄 사전 고지" 푸터
- Day 1~3 부스트 = 사전 고지 확정 스케줄
- Empire Day = 사전 공지 일자
- 추천 보너스 첫 1회 15% 단발
- 잭팟 = 무료 추첨 마케팅 리워드
- Refund/Terms 7일 청약철회권 명시

---

### 8. Phase 1 실행 순서

1. Migration (컬럼 + 테이블 + RPC)
2. `src/lib/store.ts` PACKAGES 재정의 (boostMultiplier 포함)
3. `BoostHeroCard` + `harvest_machine` 부스트 로직
4. `PackageBoostPreview` (차등) + `ActiveBoostCounter`
5. Dashboard 재구성
6. `Empire.tsx` 라운지 + Founding 카운터/토스트
7. `EmpireDayCountdown` + boost_schedule seed
8. 7일 챌린지 보조 카드
9. Wallet 보너스 분리
10. 약관/환불 업데이트

---

### 9. Phase 2 (제외)
첫 수확 777% 이벤트, 황금 머신 슬롯, 추천 대시보드, 시즌2 좌석, 마일스톤.

---

### 10. 구현 전 마지막 확인 1건
**Easy 150 부스트만 +20%로 줄여 마진 +97k 확보할까요?**
- YES: 마진 안정. Day 1 광고는 ₩56,400 (여전히 강함).
- NO: +30% 통일 유지. 마진 +37k지만 광고 임팩트 ₩61,100 우위.

이 1건 답 주시면 즉시 빌드 진입.
