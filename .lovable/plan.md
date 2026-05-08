## 현재 상태 요약

지금까지 완성한 것:
- **보안 인프라**: RLS 무결성 자가검사 SQL + pg_cron 일일 실행, 관리자 대시보드(필터/상세 모달), Vitest RLS 통합 테스트, Supabase Linter 운영 스크립트
- **정산 인프라**: cron-settle-packages 상수시간 토큰 검증 + 감사 로그, /treasury/settlements 사용자 화면(상세 모달/타임라인/거래 연동), 관리자 색상 배지 + 재시도/해결 요청
- **공유/PWA/Analytics**: OG 메타·임페리얼 PWA 아이콘·analytics 채널 게이팅

이 위에서 진짜 0.000000000001%급으로 갈 수 있는 방향은 "관측 가능성(Observability) → 자기치유(Self-Healing) → 사용자 신뢰(Trust UX) → 성능 최상단" 4축입니다.

---

## 끝판왕 작업 방향 (우선순위 순)

### 1. 정산 시스템 SLO + 자기치유 (가장 임팩트 큼)
지금은 "감사 로그"는 있지만 "스스로 복구"는 없습니다.
- `cron_settle_audit_log`에서 **연속 실패 N회 / 24h 내 실행 0건** 감지 시 자동 알림 (관리자 토스트 + 이메일)
- `package_purchases.next_settle_at < now() - 6h AND status='active'` 인 stuck 행을 찾아 자동 재정산하는 `recover_stuck_settlements()` RPC + pg_cron(매시 정각)
- 관리자 화면에 **SLO 카드**: "최근 7일 정산 성공률 / p95 duration / stuck 건수 / 다음 예정 시각"
- 모든 정산 이벤트에 `correlation_id` 부여 → transactions.metadata에 저장 → 한 클릭으로 전체 흐름 추적

### 2. 멱등성(Idempotency) + 이중정산 방지 하드닝
패키지·출금·입금 RPC가 네트워크 재시도/이중 클릭에 안전한지 코드 레벨에서 보장.
- `idempotency_keys(user_id, key, response_jsonb, created_at)` 테이블 + 모든 mutation RPC에 `_idempotency_key` 파라미터
- 클라이언트는 `crypto.randomUUID()`를 버튼 클릭마다 1개 생성, 자동 재시도 시 동일 키 재사용
- 정산은 `(purchase_id, settle_day)` UNIQUE로 DB 레벨에서 이중정산 원천 차단 (이미 있으면 검증, 없으면 추가)

### 3. 보안 메모리 → 정책 코드(Policy as Code)
지금 mem://에 있는 RLS 규칙을 **실행 가능한 단언**으로 승격.
- `policy_assertions(table, op, role, expected_result, fixture)` 테이블에 "anon이 transactions INSERT 시도 → 거부" 같은 케이스 정의
- pg_cron이 매일 실행하면서 실제로 SQL을 시도하고 결과 검증 → security_audit_log에 기록
- 새 마이그레이션 PR마다 CI에서도 동일하게 실행 (Vitest로 이미 일부 있으니 확장)
- 결과: 누군가 실수로 RLS를 약하게 만들면 24h 내 자동 감지

### 4. 실시간 사기/이상치 탐지 (Trust & Safety)
- `anomaly_events` 테이블 + 룰 엔진 SQL 함수: 1시간 내 출금 시도 N회 초과 / 같은 IP에서 다중 계정 / 정산 직후 즉시 출금 패턴
- 관리자 대시보드 "이상 탐지" 탭 → 자동 일시정지 토글
- 사용자에게는 "보안 활동 알림" UI로 본인 계정 보호 신뢰 강화

### 5. 사용자 신뢰 UX: "투명성 페이지"
0.0001% 프로젝트만 하는 것 — **공개 신뢰 지표**.
- `/trust` 라우트: 누적 정산 지급액, 평균 처리 시간, 가동률(uptime), 최근 보안 감사 PASS 비율, 최근 cron 실행 시각
- 모든 데이터는 집계 RPC(SECURITY DEFINER, search_path 고정, 개인정보 0)
- SEO + 공유 카드까지 임페리얼 골드 톤으로

### 6. 성능 최상단: Edge 캐싱 + 부분 하이드레이션
- 카탈로그성 테이블(achievements/quests/badges/seasons/tier_limits)을 **Edge KV 캐시**로 (cron으로 5분마다 워밍업)
- 라우트 단위 prefetch + `<link rel="modulepreload">` 자동 주입
- Lighthouse 100/100/100/100 + LCP < 1.0s 목표

### 7. 장애 복구 리허설 (Game Day)
- `scripts/chaos/*.ts`: 일부러 service_role 토큰 만료, cron 정지, 특정 RLS 정책 일시 비활성 등을 staging에서 실행
- 자동 알림과 자기치유가 실제로 동작하는지 검증한 결과를 `/mnt/documents/chaos-report.md`로 저장

---

## 추천 실행 순서

1. **이번 주**: #1 SLO + 자기치유, #2 멱등성  ← 운영 안정성 즉시 점프
2. **다음 주**: #3 Policy as Code, #4 이상치 탐지   ← 보안/Trust 한 단계 위
3. **그 다음**: #5 투명성 페이지, #6 성능, #7 카오스   ← 외부에 자랑 가능한 차별화

어디부터 갈지 골라주시면 그 부분만 깊게 파서 바로 구현 플랜으로 변환하겠습니다.