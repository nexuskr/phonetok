# Admin 통합 활동 로그 — 가벼운 1단계 플랜

## 목표
DB 구조·뷰·RPC·ESLint 룰 같은 **무거운 인프라는 만들지 않는다.** 대신 Admin 화면에서 mission · roulette · package · settlement · anomaly 활동을 **한 화면에서 보기**만 추가한다. 코드는 React 레벨, DB는 손대지 않음.

---

## 무엇을 하는가 (1단계 only)

### Admin → Observability Cockpit에 새 탭 1개 추가
**탭 이름**: "활동 로그" (또는 "Recent Activity")

**기능**:
- 최근 활동을 시간순 통합 리스트로 표시
- 출처(kind) 필터: 미션 / 룰렛 / 패키지 / 정산 / 이상치
- 기간 필터: 최근 24시간 / 7일 / 30일
- 항목 클릭 시 원본 row 정보 펼침 (JSON)

---

## 무엇을 안 하는가 (의식적으로 보류)

- ❌ `v_executions` view
- ❌ `get_executions()` RPC + SECURITY DEFINER
- ❌ `execution_lifecycle` enum
- ❌ `execution_access_log` 감사 테이블
- ❌ ESLint custom rule
- ❌ i18n 5컨텍스트 분리
- ❌ DB 마이그레이션 일체

→ 위 항목은 **3단계**에서 필요해질 때 다시 꺼낸다. 지금은 봉인.

---

## 구현 방식 (가장 단순한 길)

### 1) 새 컴포넌트
`src/components/admin/RecentActivity.tsx`

### 2) 데이터 가져오기 — 클라이언트 측 병렬 조회
이미 존재하는 RLS(admin은 모든 행 조회 가능)를 그대로 활용:
```text
Promise.all([
  supabase.from('mission_history').select(...).order('created_at', desc).limit(50),
  supabase.from('package_purchases').select(...).order('created_at', desc).limit(50),
  supabase.from('roulette_spins').select(...).order('created_at', desc).limit(50),
  supabase.from('transactions').select(...).eq('kind','settlement').limit(50),
  supabase.from('anomaly_events').select(...).order('created_at', desc).limit(50),
])
```
→ 클라이언트에서 병합·정렬·필터. **DB 변경 0.**

### 3) 렌더링
- 각 row를 `{ kind, ts, actor, summary, raw }` 형태로 정규화 (TS 타입만, DB enum 아님)
- Tailwind + 기존 `glass` 스타일 재사용
- kind별 아이콘·컬러 토큰 (이미 있는 디자인 시스템 활용)

### 4) 통합 위치
`src/components/admin/ObservabilityCockpit.tsx`에 탭 1개 추가 (기존 패턴 그대로).

---

## "Execution" 어휘는 — 도입만, 강제는 안 함
- 컴포넌트 내부 변수명에서만 `executions: ActivityItem[]` 같이 사용
- DB·라우트·i18n에는 영향 없음
- 사용자에게 보이는 라벨은 그대로 "미션", "룰렛", "패키지"

---

## 검증 (간단)
- [ ] /admin 접근 시 비-admin은 거부 (기존 가드 그대로 작동)
- [ ] 탭 진입 → 5개 도메인 데이터가 시간순으로 보임
- [ ] kind 필터 토글 시 즉시 반영
- [ ] 로딩 스켈레톤 / 에러 상태 표시
- [ ] 모바일(889px) 가로 스크롤 없이 가독성 OK

---

## 향후 단계 (지금은 보류)

**2단계** (체감 후 필요해지면)
- 코드 내부에서만 "execution" 개념 일관 적용 (DB는 그대로)

**3단계** (트래픽·감사 요구가 실제로 생기면)
- 그때 가서 `v_executions` + `get_executions()` + 감사 로그 인프라 도입

---

## 한 줄 결론
> **"통합처럼 보이게 UX만 정리한다. 인프라는 필요해진 다음에 만든다."**

작업 범위: 새 컴포넌트 1개, 기존 탭 영역에 끼우기. DB·마이그레이션·lint·i18n 변경 0.
