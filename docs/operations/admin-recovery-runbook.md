# Admin TOTP Recovery Runbook

3-Layer 안전망. 가벼운 → 무거운 순서로 시도하세요.

---

## Layer 1 — 본인 백업 코드 (자가 복구, 즉시)

**전제**: TOTP 등록 완료 직후 `/admin/ops/recovery`에서 백업 코드 10개를 발급받아
1Password/금고에 보관해 두었어야 합니다.

**복구 절차**
1. 비밀번호로 로그인 (AAL1).
2. 어드민 페이지 진입 시 `AdminAal2Gate` 노출 → "TOTP 분실? 백업 코드 사용" 클릭.
3. `/security/recover` 에서 코드 1개 입력.
4. 본인의 TOTP factor가 삭제됨 → `/security/totp` 자동 이동 → 새 인증 앱 등록.
5. 등록 완료 후 즉시 백업 코드 **재발급** (기존 미사용 코드는 자동 무효화).

**감사 흔적**: `admin_audit_log` (`backup_codes.consume`) + `anomaly_events`
(`admin_totp_reset_via_backup`, severity=`error`) 자동 기록.

---

## Layer 2 — 4-Eyes 동료 복구 (백업 코드도 분실)

**전제**: 활성 admin이 본인 포함 최소 3명 이상.

**절차**
1. 분실한 admin이 다른 관리자에게 슬랙/전화로 알림.
2. 다른 관리자 1명이 `/admin/ops/recovery` → "새 복구 요청"
   - 대상 UID + 사유(10자 이상, 신원 검증 근거 포함) 입력.
3. **요청자가 아닌 다른 관리자 2명**이 같은 페이지에서 "승인" 클릭.
4. 두 번째 승인이 들어오면 자동으로 `delete from auth.mfa_factors`가 실행됨.
5. 분실자는 비밀번호 로그인 후 `/security/totp` 에서 재등록.

**보호장치**
- 본인 요청 자가승인 차단 (`requester_cannot_approve`).
- 동일 admin 중복 승인 차단 (`already_approved`).
- 모든 단계 `admin_audit_log` + `anomaly_events`(`admin_totp_reset_4eyes`,
  severity=`error`) 기록.

---

## Layer 3 — Break-Glass (모든 admin 잠금)

**전제**: Layer 1·2 모두 불가. 매우 드물지만 단일-admin 운영 시 발생 가능.

**A. 자체 처리 가능 (Cloud 콘솔 직접 접근 권한 보유)**
1. Lovable Cloud → Backend → SQL Editor.
2. 다음 쿼리 실행:
   ```sql
   delete from auth.mfa_factors
    where user_id = '<잠긴 admin uid>' and factor_type = 'totp';
   ```
3. 해당 admin 비밀번호 로그인 → `/security/totp` 재등록 → 백업 코드 발급.
4. **사후 보고서 필수**: 누가 / 언제 / 왜 / 승인 절차 우회 사유를 이 문서에 기록.

**B. Cloud 콘솔 접근도 불가**
1. Lovable 지원팀(Cloud → 도움말)에 백오피스 요청.
2. 신원 검증(원래 등록 이메일/결제 카드/전화) 후 처리.
3. 수령 후 즉시 Layer 1 (백업 코드 발급) 셋업.

---

## 평시 운영 룰 (잠금 사고 예방)

| 항목 | 권장값 |
|---|---|
| 활성 admin 최소 인원 | **3명 이상** (4-Eyes 가능) |
| 백업 코드 발급 시점 | TOTP 등록 직후 + 6개월 단위 재발급 |
| 백업 코드 보관 | 1Password 공유 vault `admin-recovery` |
| Break-Glass 시드 | 인쇄 → 사무실 금고 (yearly review) |
| 사후 검토 | Layer 2/3 사용 시 7일 내 RFC 작성 |

---

## 사용 흔적 모니터링

`/admin/ops/audit` 에서 다음 action을 실시간 추적:
- `backup_codes.generate` / `backup_codes.consume`
- `recovery.request` / `recovery.approve` / `recovery.executed` / `recovery.reject`

`/admin/compliance/risk` 에서 다음 anomaly_events:
- `admin_backup_code_invalid` (warn) — 잘못된 코드 시도 → 공격 가능성
- `admin_totp_reset_via_backup` (error) — 자가 복구 발생
- `admin_totp_reset_4eyes` (error) — 동료 복구 실행
