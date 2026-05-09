# Phonara AML & 운영 검수 런북 (Runbook)

> 최종 갱신: 2026-05-09 · 담당: Treasury / Compliance / Security 합동
> 본 문서는 입금·출금·패키지 검수, 이상거래(Anomaly) 대응, 자동 동결, 권한 변경 등 자금/보안 관련 모든 운영 절차의 단일 출처(Single Source of Truth)이다.

---

## 0. 우선순위 트리아지 매트릭스

| 등급 | 정의 | 1차 응답 SLA | 처리 SLA |
|------|------|--------------|----------|
| **P0 / Critical** | 자동 동결 발동, 대량 출금(≥1억 원), 관리자 권한 변경 알림, 보안 사고 의심 | 5분 | 30분 |
| **P1 / High** | 단일 출금 ≥1,000만 원, 동일 IP 다계정 의심, OCR 불일치 영수증 | 30분 | 4시간 |
| **P2 / Normal** | 일반 입출금/패키지 검수, 신규 가입 KYC | 4시간 | 24시간 |
| **P3 / Low** | 단순 메모/문의 대응 | 24시간 | 72시간 |

---

## 1. 입금(Deposit) 검수 SOP

### 1.1 큐 진입
- 화면: `/admin` → **Deposits** 탭 (`DepositRequestsAdmin`)
- 정렬: `status='pending'` 우선, 오래된 순
- 자동 인입: 사용자가 `validate_deposit_input` RPC 통과한 요청만 큐 진입

### 1.2 검수 체크리스트 (모두 ✓ 후 승인)
1. **금액 일치** — 영수증 금액 == 요청 금액 (±0원)
2. **송금자 일치** — 영수증 송금자명 == 프로필 실명 (한글/영문 표준화 후 비교)
3. **계좌 일치** — 영수증 수취 계좌 == 회사 지정 입금 계좌
4. **시간 합리성** — 영수증 시각 ≤ 요청 생성 시각 + 24h
5. **AI OCR 결과** — `receipt-ocr` 엣지 함수 호출 → 자동 체크 표시 확인
6. **이상거래 없음** — 동일 사용자 `anomaly_events`에 미해소(`acknowledged=false`) 0건

### 1.3 액션
- ✅ **승인** → 잔액 자동 증액, 사용자에게 푸시/인앱 알림 발송
- ❌ **반려** → 사유 코드 선택(`amount_mismatch`/`name_mismatch`/`fake_receipt`/`other`) + 메모 기재 (사용자에게 노출)
- 🔒 **에스컬레이션** → 1억 원 초과 또는 OCR 불일치 시 컴플라이언스 책임자 더블체크 후 승인

### 1.4 특이 케이스
- **분할 입금**: 동일 송금자가 24h 내 3회 이상 → P1 승격, KYC 재확인
- **타인 명의 입금**: 즉시 반려 + `anomaly_events`에 `third_party_deposit` 수동 기록

---

## 2. 출금(Withdrawal) 검수 SOP

### 2.1 사전 자동 차단
- PIN 5회 연속 실패 → `pin_lockouts`에 의해 24h 자동 락
- Rate limit (4회/분) 초과 → `enforce_rate_limit` RPC 차단 + anomaly 기록

### 2.2 검수 체크리스트
1. **잔액 충분** — 요청액 ≤ 사용 가능 잔액 (대기 출금 차감 후)
2. **계좌 검증** — 예금주명 == 프로필 실명, 계좌번호 정규식 통과
3. **AML 게이트** — `AMLGate` 통과 (당일 누적 출금 한도, 신규 계좌 첫 출금 24h 홀드)
4. **이상거래 없음** — 자동 동결 미발동, 미해소 anomaly 0건
5. **세금/수수료** — 자동 계산값 노출 일치

### 2.3 액션
- ✅ **승인** → ETA 안내 (`WithdrawETABadge`), 송금 처리 후 영수증 업로드(`WithdrawReceiptUpload`)
- ❌ **반려** → 잔액 환원, 사용자 알림 + 사유
- ⏸ **보류(Hold)** → 24h 추가 검토 (대량/이상거래 의심)

### 2.4 대량 출금 (≥1,000만 원)
- 2명 이상 관리자 더블 사인오프 필수
- Treasury 책임자에게 수동 알림 후 진행

---

## 3. 이상거래(Anomaly) 대응

### 3.1 자동 트리거
- `tg_anomaly_autofreeze`가 다음 조건에서 24h 자동 동결:
  - severity = `critical` 1건
  - severity = `high` 10분 내 3건 누적
- 동결 발동 시 → `account_freezes` INSERT + Realtime 브로드캐스트 → `/admin/perms` 탭 알림

### 3.2 수동 대응 (`AMLAdmin` 화면)
1. 대시보드에서 미해소 이벤트 확인
2. 사용자 상세 → 최근 60일 거래 패턴 분석
3. 결정:
   - **무해(False positive)** → `acknowledge` + 메모
   - **계속 모니터링** → 메모만 남김
   - **계정 동결** → 수동 freeze 7일 / 30일 / 영구
   - **자금 회수** → 출금 차단 후 입출금 합산 검토

### 3.3 이벤트 카테고리별 권장 대응
| 카테고리 | 권장 액션 |
|---------|----------|
| `rate_limit_exceeded` | 모니터링, 반복 시 24h 동결 |
| `pin_brute_force` | 자동 락 확인, 본인 확인 후 해제 |
| `large_withdrawal` | 더블 사인오프, KYC 재확인 |
| `velocity_breach` | 동결 + 자금원 입증 요청 |
| `multi_account_ip` | 모든 연관 계정 동시 동결 후 조사 |

---

## 4. 권한(Permission) 변경 모니터링

- 모든 `user_roles` 변경은 `permission_change_log`에 자동 기록 (트리거)
- `/admin/perms` 탭 → Realtime 채널 구독 → 즉시 표시
- **검토 절차**:
  1. 변경 전후 역할 비교
  2. 변경자(actor)와 대상자(target) 관계 확인
  3. 권한 baseline drift는 매일 `check_permission_drift()` RPC 자동 검사 + GitHub Actions에서 PR마다 실행

---

## 5. 푸시 알림 운영

- VAPID 키는 Lovable Cloud Secrets에 저장 (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
- 키 노출 사고 시: 즉시 회전 + 모든 `push_subscriptions` truncate → 사용자 재구독 유도
- 송신 실패율 모니터링: `send-push` 엣지 함수 로그에서 4xx/5xx 비율 5% 초과 시 알림

---

## 6. 사고 대응 플레이북 (Incident Response)

### 6.1 보안 사고 의심 시
1. **격리** — 의심 계정 즉시 freeze + 세션 강제 만료
2. **보존** — `anomaly_events`, `permission_change_log`, `notifications`, edge function logs 스냅샷
3. **분석** — 30분 이내 1차 보고서 (관련 IP/디바이스/거래 정리)
4. **복구** — 무관 사용자 영향 시 부분 롤백 검토 (마이그레이션 단위)
5. **사후** — 24h 이내 포스트모템, 재발 방지 마이그레이션/룰 추가

### 6.2 자금 손실 의심 시
- Treasury 일일 결산(`TodayKpiCards`) 이상치 확인
- `deposit_requests` + `withdrawal_requests` + `package_purchases` 합계 vs 실제 계좌 잔액 대조
- 차이 발생 시 P0, 모든 출금 즉시 일시 중단 (`account_freezes` 글로벌 락 검토)

---

## 7. 일일 운영 체크리스트 (매일 09:00 KST)

- [ ] `TodayKpiCards` 리뷰 — 입출금 순증감, 대기 큐 길이
- [ ] 미해소 `anomaly_events` 확인 (목표: 0건)
- [ ] 자동 동결 발동 사례 회고 (False positive 비율 점검)
- [ ] `/admin/perms` 권한 변경 로그 검토
- [ ] CI `db-permissions.yml` 통과 여부 확인
- [ ] 푸시 알림 발송 실패율 점검

---

## 8. 연락 체계

| 역할 | 1차 | 2차 | 에스컬레이션 |
|------|-----|-----|-------------|
| Treasury | 운영팀 | Treasury 리드 | CFO |
| Security | 보안 당직 | 보안 리드 | CTO |
| Compliance | 컴플라이언스 담당 | 법무 | CEO |

> 🚨 **P0 사건 발생 시**: 위 3개 라인 동시 호출 + Slack `#incident` 채널 즉시 오픈
