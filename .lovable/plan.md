## Phonara Starter 탭 최종 실행 계획

기존 `src/pages/Guide.tsx`의 `StarterGuide` + `EarningsSimulator` + `handbook_progress` RPC를 살리고, **컴플라이언스 안전장치 / AML 단일 소스 / 0유저 신뢰 카운터** 세 축으로 마감합니다.

---

### A. AML 한도 단일 소스
- **신규** `src/lib/aml-tiers.ts` — 3단 한도(< 100만 / 100만~1,000만 / > 1,000만)와 라벨·요구 인증을 하나의 const로. UI/테스트 모두 여기서 import.
- **신규** `src/test/aml-tiers.test.ts` — 상수와 서버 정책의 한도가 일치하는지 1줄 스냅샷.

### B. 0유저 신뢰 카운터 RPC
- **마이그레이션**: `get_starter_trust_stats()` SECURITY DEFINER, anon 호출 가능. `daily_stats` + `withdrawal_requests`에서 오늘 보너스 건수/금액, 무수료 출금 누적액 집계. `function_permissions_baseline` 등록.
- 결과 0건이면 폴백 카피("막 시작된 제국") 노출 — 가짜 숫자 금지.

### C. UI 리디자인 (`src/pages/Guide.tsx`)
- **STEP 0 Hero**: `aspect-video` 슬롯(영상 자리, CLS 방지) + `<TrustCounter />` (B의 RPC, 30초 polling).
- **STEP 1~3**: 카피만 정리(아래 D), 동작 그대로.
- **STEP 4**: `EarningsSimulator` 결과 카드를 "예상 누적 보상 한도 (시뮬레이션)" + min~max 범위 + 회색 disclaimer. "코인 +8% (최초 1회)" 배지.
- **STEP 5**: AML 3단 가로 스크롤 카드, 사용자의 `aml_verifications.level` 하이라이트. CTA "연습 출금" → `AMLGate`에 `mode="preview"` prop 추가, 실제 출금 RPC 미호출.
- **STEP 6**: `referrals` count 0이면 "1번째 추천인 = 영구 Founding Inviter 뱃지" 분기 카피.

### D. 컴플라이언스 카피 (`src/lib/i18n.ts`)
- `starter.*` ko/en 키 일괄 정리: "확정 / 평생 / 보장" → "예상 / 지속 / 시뮬레이션".
- `EarningsSimulator` 하드코딩 라벨도 i18n 키화.

### E. 완료 연출
- 6/6 도달 시 가벼운 CSS sparkle confetti + 기존 `EarnedToast` + sonner 토스트, `claim_handbook_bonus` 자동 호출, 알림은 RPC 내부에서 `notifications` insert.

### F. 라우팅
- `/` Index 첫 진입 시 비로그인 유저 → `/guide?tab=starter` 부드러운 유도. `SixtySecondFlow` 미완료자는 우선순위 유지.

### G. 사이드 픽스
- realtime 채널에서 `subscribe()` 이후 `.on()` 호출하는 버그(`Layout.tsx`/`NeonNotificationFeed.tsx` 의심) → 채널 생성 → on() → subscribe() 순서로 정리.

### H. 검증
- `tsc --noEmit`, vitest(A 상수 테스트 + 시뮬레이터 출력 범위 스냅샷).
- 모바일 391px Lighthouse 점검: Hero CLS=0.
- AML 상수 ↔ 화면 노출 숫자 100% 일치 수동 확인.

---

### 변경/추가 파일

```text
new:
  src/lib/aml-tiers.ts
  src/components/guide/TrustCounter.tsx
  src/test/aml-tiers.test.ts
  supabase/migrations/<ts>_starter_trust_stats.sql

edit:
  src/pages/Guide.tsx
  src/components/guide/EarningsSimulator.tsx
  src/components/wallet/AMLGate.tsx           (preview prop)
  src/lib/i18n.ts                             (starter.* 키 정리)
  src/components/Layout.tsx 또는
  src/components/NeonNotificationFeed.tsx     (realtime 채널 중복 구독 픽스)
```

---

### 핵심 안전장치 요약
1. 모든 수익 표현 → "예상 누적 보상 한도 (시뮬레이션)" + 보장 부정 disclaimer.
2. AML 한도 숫자는 `aml-tiers.ts` 단일 소스 → UI·테스트 동기화.
3. 0유저 화면은 실시간 신뢰 카운터로 빈 화면 방지(0이면 정직한 폴백).
4. STEP 5에서 무수료 + AML을 카드로 친근하게 미리 공개 → STEP 4 전환 끌어올림.

승인해 주시면 A → H 순서로 그대로 구현합니다.
