# 🛠️ Admin Self-Heal Console — 운영자 단독 운영 모드

> 목표: **앞으로 사이트에서 오류가 나도 팀장님이 어드민에 들어가서 직접 진단·복구·재시작**할 수 있게, 한 페이지에 "운영자 손이 필요한 모든 액션"을 모은 풀버전을 만듭니다. 저(AI)에게 매번 코드를 고쳐달라고 안 해도 되는 게 핵심.

---

## 1. 전체 구성 — `/admin/ops/self-heal` (신규 단일 진입점)

기존 사이드바 **운영(Operations)** 섹션 최상단에 `🛟 Self-Heal 콘솔`을 추가합니다 (AAL2 보호). 한 페이지에 8개 패널을 탭으로 묶음:

```text
┌─ Self-Heal Console (AAL2) ────────────────────────────────────┐
│ [개요] [진단] [큐/잡] [캐시] [Realtime] [DB] [엣지함수] [긴급] │
└────────────────────────────────────────────────────────────────┘
```

### Tab 1. 개요 (Health Overview)
- 한눈에 보는 시스템 신호등: DB·Auth·Edge·Realtime·Oracle·Cron 6종
- 최근 1시간 / 24시간 에러 카운트 (`error_logs`, `anomaly_events`)
- 최근 5분 활성 사용자 / 진행 중 베팅 / 대기 출금 / 동결 계정 수
- "지금 해야 할 일" 액션 카드 자동 생성 (예: "출금 12건 대기 → 처리하기")

### Tab 2. 진단 (Diagnostics)
- **자동 헬스체크 12종** — 각 항목 실행/PASS·FAIL 표시, 결과 JSON 펼쳐보기
  - Oracle 졸업 게이트 5종 (기존 `admin_get_oracle_swap_readiness`)
  - 권한 drift (`check_permission_drift`)
  - Stuck LPI 인텐트 (`monitor_lpi_stuck_reserved`)
  - Cron 지연 (마지막 실행 시각 vs 예상)
  - 미정산 가드 (settlement queue lag)
  - RLS 정책 누락 테이블 스캔
  - 트리거 비활성 감지
  - 미해결 anomaly 상위 10
- **"전체 진단 실행"** 버튼 — 전 항목 순차 실행 + 결과 다운로드(JSON)

### Tab 3. 큐 / 잡 (Queues & Jobs)
- 출금/충전/AML/환불 대기 큐 카운트 + "큐 처리 페이지로 이동"
- Cron 작업 목록 + 마지막 실행 시각 + **수동 트리거 버튼** (지원되는 RPC만)
  - `settle_ended_founding_seasons`, `settle_guild_weekly`, `reclaim_stale_intents`, `monitor_lpi_stuck_reserved`, `oracle-consensus-tick` 등
- 실행 결과 인라인 토스트 + 감사로그 자동 기록

### Tab 4. 캐시 / 클라이언트 상태 (Cache & Client)
- "전체 사용자 강제 리로드" (브로드캐스트 채널로 `force_refresh` 송신 → 클라이언트 자동 새로고침)
- "특정 유저 세션 무효화" (user_id 입력 → `auth.admin.signOut`)
- "Realtime 채널 통계" — 활성 구독자 수, 가장 바쁜 채널 Top 10
- 클라 React Query 키 무효화 신호 (전역/유저별)

### Tab 5. Realtime 헬스
- 채널 연결률 / 재연결 횟수 / 최근 에러
- "Realtime 재시작 신호 보내기" (전 클라이언트 reconnect)
- 최근 30분 dropped events 카운트

### Tab 6. DB 도우미
- **테이블 행 카운트 대시보드** (주요 25개 테이블)
- **마이그레이션 상태** — 마지막 적용 시각
- **느린 쿼리 Top 10** (pg_stat_statements 노출되면)
- **읽기 전용 SQL 실행기** — admin만, SELECT/EXPLAIN만 허용 (서버 가드)
  - 결과 테이블 + CSV 다운로드
  - 실행 이력 자동 감사로그

### Tab 7. 엣지 함수
- 배포된 함수 목록 + 마지막 호출 시각 + 24h 호출/에러 수
- "함수 재호출 테스트" 버튼 (페이로드 입력 가능)
- 최근 100개 로그 인라인 뷰 (검색 + 레벨 필터)

### Tab 8. 긴급 (Emergency / Kill Switch) — 빨간 영역
- 🔴 **거래 중단** (전 사용자 베팅/출금 일시 정지 플래그)
- 🔴 **출금 중단** (출금만 정지)
- 🔴 **신규 가입 중단**
- 🔴 **유지보수 모드 ON/OFF** (전 사용자에게 maintenance 배너)
- 🟡 **특정 유저 동결/해제** (`is_account_frozen` 즉시 토글)
- 🟡 **공지 즉시 푸시** (전체 토스트 + Lounge 핀)
- 모든 액션은 사유(reason) 필수 + 감사로그 + 슬랙/이메일 알림

---

## 2. 백엔드 — 신규 RPC & 테이블

### 신규 테이블
- `platform_kill_switches(key text pk, enabled bool, reason text, set_by uuid, set_at timestamptz)`
  - 키: `trading_halt`, `withdrawals_halt`, `signup_halt`, `maintenance_mode`
- `admin_action_log(id, admin_id, action, target, payload jsonb, result jsonb, created_at)`
  - 모든 Self-Heal 액션 자동 기록

### 신규 RPC (admin-only, AAL2 강제)
- `admin_run_healthcheck(name text)` → 단일 항목 실행
- `admin_run_all_healthchecks()` → 12종 일괄
- `admin_trigger_cron(job_name text)` → 화이트리스트만
- `admin_set_kill_switch(key, enabled, reason)`
- `admin_get_kill_switches()`
- `admin_force_user_signout(user_id)`
- `admin_broadcast_refresh(scope: 'all' | user_id)`
- `admin_exec_readonly_sql(sql text)` — 정규식 가드 (`^\s*(select|explain|with)\b`, 세미콜론 1개), 5초 타임아웃, LIMIT 1000 강제
- `admin_get_table_counts()` — 주요 테이블 24개
- `admin_get_realtime_stats()`
- `admin_get_edge_function_stats()`

### 클라이언트 가드 추가
- `useKillSwitches()` 훅을 루트에 마운트 → `trading_halt`/`withdrawals_halt` 켜지면 베팅·출금 버튼 자동 비활성 + 안내
- `maintenance_mode` ON → 비-admin은 전체 화면 유지보수 페이지

---

## 3. 자동화 — "운영자가 안 봐도 되는" 영역
- Cron `every 5min` `auto_heal_tick()` 실행:
  - stale LPI > 120s → 자동 reclaim
  - oracle 5게이트 fail 발생 → admin 알림(`anomaly_events` severity=high)
  - error_logs 5분 내 50건 초과 → kill switch 후보 알림 (자동 차단은 X, 알림만)
- 결과는 `auto_heal_log`에 기록, Self-Heal Tab 1 개요에 노출

---

## 4. UI / 컴포넌트 (frontend)
- `src/pages/admin/ops/SelfHeal.tsx` — 8탭 컨테이너
- `src/components/admin/self-heal/` 하위 8개 패널 컴포넌트
- 디자인 토큰만 사용 (semantic), 빨강 영역은 `destructive` 토큰
- 모든 액션은 `notify` 사용, 빈/로딩 상태는 `EmptyState`/`LoadingList`
- `<AdminAal2Gate>`로 페이지 전체 보호
- 사이드바 `_nav.ts` operations 최상단에 `self-heal` 항목 추가 + ⌘K 등록

---

## 5. 안전장치
- 모든 파괴적 액션: **사유 입력 필수 + 2단계 확인 다이얼로그 + AAL2 + 30일 감사로그**
- `admin_exec_readonly_sql`: SELECT/EXPLAIN/WITH만, statement_timeout 5s, 결과 1000행 cap, 결과+쿼리 자동 로그
- Kill switch 토글은 슬랙/이메일 즉시 통보 (선택)
- 모든 RPC는 `function_permissions_baseline`에 등록 → drift 감지 자동 포함

---

## 6. 산출물 요약
- 신규 페이지 1개 (`/admin/ops/self-heal`) + 8개 패널 컴포넌트
- 신규 마이그레이션 1개: 2개 테이블 + 12개 RPC + 1개 cron + RLS
- 사이드바 / ⌘K 항목 추가
- 클라이언트 kill-switch 훅 + maintenance 모드 페이지
- 문서 1장: 운영자용 "오류 났을 때 30초 가이드"

이걸 끝내면 일반적인 운영 이슈(큐 막힘, 캐시 꼬임, 특정 유저 문제, 세션 잠김, 임시 차단, 진단)는 **저 없이 팀장님 혼자** 해결 가능합니다. 코드 버그(React 에러 같은 건)는 여전히 제가 필요하지만, 그 외 90%는 셀프 처리 가능.
