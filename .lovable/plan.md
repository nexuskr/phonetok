# Sprint 1 — Week 3: Earn Hub MVP + Viral Foundation

목표: "매일 무료로 돈 버는 곳" 약속을 실제로 동작하는 5장 카드로 구현하고,
공짜 성장의 두 엔진(친구 초대 + 빅윈 자동 공유)을 살아 움직이게 만든다.
회귀 0 — 기존 미션/리퍼럴 인프라를 재사용한다.

## 활용할 기존 자산

테이블: `profiles.attendance_streak/last_attendance`, `referrals`, `referral_earnings`, `mission_history`, `share_events`, `phon_balances`
RPC: `claim_daily_attendance(user_id)`, `apply_referral_code(code)`, `gen_referral_code()`, `set_referral_code()`, `get_referral_stats()`, `get_referral_leaderboard()`, `log_share_event(trigger,action,channel,payload)`, `_credit_referral_first_deposit`, `_credit_referral_commission`

## 1. 백엔드 (단일 migration)

신규 테이블 `daily_quick_claims`
- `user_id uuid not null`
- `kind text not null check(kind in ('mission_play','mission_invite','mission_deposit','play_today','share_today'))`
- `day date not null default (now() at time zone 'Asia/Seoul')::date`
- `amount bigint not null`
- unique(user_id, kind, day) — 하루 1회 멱등
- RLS: self select / admin all

신규 RPC `claim_daily_quick_reward(_kind text) returns jsonb`
- 화이트리스트 + 서버 정의 보상 테이블(클라 변조 불가):
  - mission_play=100, mission_invite=150, mission_deposit=300, play_today=80
- INSERT ... ON CONFLICT DO NOTHING; conflict면 `{ok:false, reason:'already'}`
- 성공 시 `update phon_balances set phon = phon + amount` + return `{ok:true, amount, balance}`

신규 RPC `claim_share_reward(_channel text) returns jsonb`
- 채널 화이트리스트(instagram/tiktok/youtube/x/naver/kakao/line/copy)
- daily_quick_claims kind='share_today' upsert, amount=200 (일 1회)
- `log_share_event('earn_hub','shared',_channel,jsonb_build_object('reward',200))`
- phon +200, return `{ok,amount,balance}`

신규 RPC `get_earn_hub_state() returns jsonb`
- 한 번 호출로 카드 5개에 필요한 모든 상태 반환:
  - streak: { day, last, claimed_today }
  - missions: [{kind, amount, claimed}] (mission_play/invite/deposit)
  - play_today: { claimed, amount }
  - share_today: { claimed, amount }
  - referral: { code, signups, deposits, total_phon_earned }
- 모든 read는 자기 자신만 — SECURITY DEFINER + set search_path

함수 권한: authenticated GRANT EXECUTE, anon REVOKE.

## 2. 프런트엔드 (재구성된 /earn)

`src/pages/Earn.tsx` — 5장 라이브 카드 그리드 (모바일 1열, md 2열, lg 3열).
헤더는 따뜻하고 큼직한 카피("오늘은 얼마 벌었나요?") + 오늘 누적 PHON 카운터.

신규 컴포넌트 (`src/components/earn/`):
- `StreakCard.tsx` — D1~D7 칩, `claim_daily_attendance` 호출, 보상 미리보기 (100→1500)
- `MissionsCard.tsx` — 3개 미션 체크리스트(`mission_play`/`invite`/`deposit`), 각 카드에서 claim 버튼 → `claim_daily_quick_reward`
- `ReferralCard.tsx` — 내 코드 + 복사 + 카카오/X 즉시 공유 + 최근 가입자/입금자 카운트(`get_earn_hub_state.referral`)
- `PlayToEarnCard.tsx` — "오늘 한 게임 = +80 PHON" CTA(/games), claim은 슬롯 진입 후 자동 호출되도록 슬롯 로비에서 dispatch
- `ShareRewardCard.tsx` — "빅윈 공유 1회 = +200 PHON" → `BigWinShareDialog` 오픈

모두 색상은 디자인 토큰만 (`--gold`/`--pink`/`--card`/`--text`/`--muted`). 50–70대 가독성: 본문 14px+, 버튼 44px+, 한글 keep-all, 큰 숫자 `font-hud tabular-nums`.

상태 훅 `src/hooks/use-earn-hub.ts` — 단일 RPC로 상태 패칭 + zustand-스러운 mutate, claim 후 즉시 낙관 업데이트.

토스트는 `@/lib/notify`만. 빈/로딩은 기존 `EmptyState`/`LoadingList`.

## 3. 바이럴 — 빅윈 자동 공유

신규 `src/components/share/BigWinShareDialog.tsx`
- props: `{ amount: number, kind: 'bigwin'|'achievement', symbol?: string }`
- 카드 캔버스: 1080×1350 (인스타·세로형). HTML2Canvas 대신 순수 canvas로 그라데이션 배경 + PHONARA.WORLD 워드마크 + 큰 숫자 + 닉네임 마스킹
- 8 채널 버튼 그리드: Instagram, TikTok, YouTube, X, Naver Blog, KakaoTalk, LINE, "이미지 저장"
- 각 버튼 클릭 시:
  - 이미지 toBlob → `navigator.share`(가능 시) 또는 채널별 intent URL 새 창
  - 동시에 `claim_share_reward(channel)` 호출 → +200 PHON 토스트 (1회/일)
  - `log_share_event('bigwin','shared',channel)`

전역 트리거: `window.dispatchEvent(new CustomEvent('phonara:bigwin', { detail:{amount, symbol}}))` 호출만으로 다이얼로그 오픈되도록 `App.tsx`에 mount(`<BigWinShareHost />`).
Wallet 출금 성공 / 슬롯 빅윈(기존 BigWinModal 위치) / 트레이딩 청산 익절에서 dispatch 한 줄만 추가.

`ShareRewardCard`의 "공유하고 받기" 버튼은 같은 다이얼로그를 "성취 카드" 모드로 연다(누적 수익 사용).

## 4. 친구 초대 강화

`src/pages/Referral.tsx`는 유지하되 `ReferralCard`에서 핵심 액션을 Earn 내부에서 끝낼 수 있게 한다.
- 가입 보너스 +200 PHON, 첫 입금 시 양쪽 +2,000~3,000 PHON 정책은 기존 `_credit_referral_first_deposit`이 처리하므로 신규 정책 변경 없음.
- 카피 명확화: "친구 가입 +200 / 친구 첫 충전 시 양쪽 +2,000 (VIP 친구 +3,000)".
- 공유 버튼은 카카오/문자/링크 복사 3개를 1탭에 노출.

## 5. 통합 / QA

- TopBar PHON 잔액은 `useMyPower` realtime에 phon_balances 구독이 이미 있어 자동 갱신.
- Onboarding V3 step3(출석) → step5(충전) 완료 후 Earn으로 deep-link.
- 모바일 PWA: 카드 그리드 1열, 버튼 fixed-safe-bottom 여백 유지.
- 회귀: `/missions`, `/referral`, `/casino` 라우트 그대로. Earn은 추가 진입점.

## 산출물 요약

신규 파일:
- migration (daily_quick_claims + 3 RPC)
- `src/hooks/use-earn-hub.ts`
- `src/components/earn/StreakCard.tsx`, `MissionsCard.tsx`, `ReferralCard.tsx`, `PlayToEarnCard.tsx`, `ShareRewardCard.tsx`
- `src/components/share/BigWinShareDialog.tsx`, `BigWinShareHost.tsx`
- `src/lib/earnHub.ts` (RPC 래퍼), `src/lib/bigwinShare.ts` (전역 dispatch + 채널 intents)

수정:
- `src/pages/Earn.tsx` 풀 재작성(5 라이브 카드)
- `src/App.tsx` BigWinShareHost 마운트
- (선택) `src/pages/Casino.tsx` 진입 시 `claim_daily_quick_reward('play_today')` 호출

## 기술 메모

- 모든 신규 RPC는 SECURITY DEFINER + `set search_path = public`로 안전 가드, authenticated만 EXECUTE.
- 보상 금액은 서버 상수 — 클라 변조 불가.
- 멱등성: `daily_quick_claims` unique(user_id,kind,day)로 동시 다발 클릭 안전.
- `claim_share_reward`는 채널마다 보상이 아니라 "오늘 1회 공유" 보상 — 무한 farming 방지.
- 디자인 토큰 100% 준수, 새 색 클래스 금지. framer-motion 0.2~0.3s.

## 성공 기준 (Week 3)

- /earn 5카드 모두 실제 RPC와 연결되어 claim → 잔액 즉시 반영
- 빅윈 시 자동 공유 다이얼로그 노출 + 1탭 공유 + 보상 지급
- 친구 초대 링크 → 가입 → 첫 입금 → 양쪽 PHON 자동 지급 흐름 동작
