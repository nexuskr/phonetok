
# Phonara SMS-Free 인증 전환 플랜

현재 `SecureAuth.tsx` 는 이메일+비밀번호 / Google / Apple 을 지원하고, 회원가입 시 전화번호를 수집해 출금 SMS에 사용 중. SMS 의존을 단계적으로 제거하고 4가지 SMS-Free 인증을 도입.

## 목표 인증 매트릭스

| 우선순위 | 방법 | 사용 위치 | 비고 |
|---|---|---|---|
| 1 | Google / Apple OAuth | 신규/기존 로그인 (기본 노출) | 이미 구현, 노출 강화 |
| 2 | Email Magic Link / OTP | 비번 없는 로그인, 출금 본인확인 | 신규 |
| 3 | TOTP (Authenticator) | 2FA, 출금 PIN 대체 | 신규 |
| 4 | Passkey (WebAuthn) | 차세대 로그인 | 신규 (옵트인) |

## Phase A — Magic Link / Email OTP (가장 큰 효과)

1. `SecureAuth.tsx` UI 개편:
   - 탭 구조 변경: **OAuth (구글/애플) → 이메일 매직링크 → 비밀번호 (legacy)** 순으로 우선순위 재정렬
   - 비밀번호 가입 폼은 "고급" 토글 안으로 숨김
2. 신규 액션 `sendMagicLink(email)`:
   - `supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: origin+'/auth/callback' }})`
   - 동일 함수로 가입+로그인 동시 처리 (`shouldCreateUser:true`)
3. `/auth/callback` 페이지 신설 — Supabase가 토큰 hash로 리다이렉트하므로 `supabase.auth.exchangeCodeForSession`/`getSession` 처리 후 `/` 이동
4. 출금 본인확인용 6자리 OTP:
   - 새 RPC `request_withdraw_otp()` → `auth.signInWithOtp({email, channel:'email'})` 와 별개로 자체 `withdraw_otp_codes(user_id, code_hash, expires_at)` 테이블 + `verify_withdraw_otp(code)` RPC
   - 기존 `request_withdrawal` 호출 전 OTP 검증 단계 추가

## Phase B — TOTP 2FA (Authenticator 앱)

1. Supabase Auth MFA(TOTP) 활성화 (Cloud → Auth Providers → MFA)
2. 신규 페이지 `/security/totp`:
   - `supabase.auth.mfa.enroll({ factorType:'totp' })` → QR 코드 표시
   - `supabase.auth.mfa.challenge` + `verify(code)` 로 등록 완료
3. 로그인 후 AAL 체크: `mfa.getAuthenticatorAssuranceLevel()` 로 AAL2 필요 화면(출금/관리자) 보호
4. 출금 흐름 통합:
   - 기존 `withdraw_pin_hash` 비교 로직을 "TOTP 6자리 코드 검증" 으로 교체
   - 미설정 사용자는 비밀번호 PIN fallback 유지 (마이그레이션 윈도우)
5. 관리자(`/admin`)는 TOTP 강제 (AAL2 미달 시 차단)

## Phase C — Passkey / WebAuthn

1. Supabase Auth WebAuthn factor (`factorType:'webauthn'`) 활용
2. `/security/passkey`:
   - `mfa.enroll({ factorType:'webauthn', friendlyName })` → 브라우저 `navigator.credentials.create` 자동 호출
   - 등록된 passkey 목록/삭제 UI
3. 로그인 화면 상단에 "Passkey 로 로그인" 버튼 — `mfa.challengeAndVerify` 로 단일 클릭 로그인
4. 모바일 Safari/Chrome 호환성 가드: `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` false 면 비노출

## Phase D — SMS 의존 제거

1. `tg_withdrawal_status_notify` 트리거의 SMS dispatch를 옵션화:
   - `notification_preferences.sms_enabled` 컬럼 기본 false
   - 사용자가 명시적으로 켠 경우만 Twilio 호출
2. `SecureAuth` 회원가입 폼에서 `phone` 필드를 **선택 사항**으로 변경 (zod regex → optional)
3. `profiles.phone` 미입력 사용자도 정상 진행 — 알림은 인앱+이메일 기본
4. 이메일 알림 인프라가 없을 경우 `email_domain--setup_email_infra` 호출하여 출금 상태 이메일 활성화

## 데이터베이스 변경

```sql
-- withdraw_otp_codes
CREATE TABLE public.withdraw_otp_codes (
  id uuid PK,
  user_id uuid (FK auth.users),
  code_hash text,
  attempts int default 0,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz
);
-- RLS: 본인만 SELECT, INSERT는 SECURITY DEFINER RPC 만

-- notification_preferences
ALTER TABLE profiles
  ADD COLUMN sms_notifications_enabled boolean DEFAULT false,
  ADD COLUMN email_notifications_enabled boolean DEFAULT true;
```

## UI 변경 파일

- `src/pages/SecureAuth.tsx` — 매직링크 우선 UI
- `src/pages/AuthCallback.tsx` (신규)
- `src/pages/security/Totp.tsx` (신규)
- `src/pages/security/Passkey.tsx` (신규)
- `src/components/withdrawal/WithdrawOtpDialog.tsx` (신규) — 출금 전 6자리 OTP
- `src/pages/Admin.tsx` — AAL2 가드

## 보안 고려

- TOTP secret 은 Supabase Auth 가 관리 (별도 저장 X)
- Magic Link 토큰은 1회용 + 짧은 TTL (Supabase 기본 1시간 — 출금 OTP 는 5분으로 단축)
- AAL2 강제 페이지: `/admin/*`, `/wallet/withdraw`
- Passkey 미지원 브라우저 fallback: TOTP

## 실행 순서

1. Phase A (가장 빠른 ROI): 매직링크 + 출금 OTP — 약 1 작업 묶음
2. Phase B: TOTP + AAL 가드
3. Phase C: Passkey (옵션)
4. Phase D: phone 필드 옵션화 + SMS off-by-default

## 확인이 필요한 항목

- Phase B 에서 기존 `withdraw_pin` 사용자는 강제 마이그레이션? 아니면 양립 유지? (현재 플랜 = 양립 유지)
- Phase C Passkey 를 로그인 1차 수단으로 노출 vs 2FA 전용? (현재 플랜 = 1차 + 2FA 둘 다)
- Magic Link 사용 시 회원가입 폼의 닉네임/실명 수집은 가입 직후 `/complete-profile` 에서 받을지 — OAuth 와 동일 흐름 권장

승인되면 **Phase A 부터** 즉시 구현 시작합니다.
