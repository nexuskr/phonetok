## 확인 결과

현재 상태는 사용자가 승인한 계획과 완전히 일치하지 않습니다.

### 확정된 오류 원인
- `src/lib/slots-rpc.ts`
  - `const rpc = supabase.rpc as any` 로 메서드를 떼어 호출하고 있어 `this` 바인딩이 깨집니다.
  - 그 결과 보충/스핀 시 내부적으로 `Cannot read properties of undefined (reading 'rest')` 가 발생합니다.
  - 즉, 보충 실패/스핀 실패는 백엔드 자체보다 클라이언트 호출 방식 버그입니다.

### 계획 대비 실제 어긋난 점
- 원 계획: PixiJS 기반 슬롯 엔진
- 실제 구현: React state + interval 기반 간이 애니메이션
- 원 계획: `SlotCanvas`, `SlotControls`, `SlotHeader`, `SlotFooter`, `SlotGameInfo`, `ModeToggle`, `WinOverlay`, `FreeSpinWheel`, `BuyBonusButton`, `useSlotGame`, `useFakePlayerCount`
- 실제 구현: 대부분 단일 `OlympusSlot.tsx`에 뭉쳐 있음
- 원 계획: Bonus Wheel 8세그먼트 UI 포함
- 실제 구현: 휠 UI 없음
- 원 계획: `/dashboard` 에 카지노 진입 카드 추가
- 실제 구현: 라우트/메뉴는 생겼지만 대시보드 진입 카드는 없음
- 원 계획: 모바일 60fps QA 반영
- 실제 구현: 슬롯 페이지에서도 전역 오버레이/위젯이 그대로 마운트되어 초기 로드가 무거움

### 렉 원인
- 슬롯 애니메이션이 80ms interval로 전체 그리드를 계속 리렌더함
- 슬롯 페이지가 일반 `Layout`을 그대로 써서 카지노와 무관한 전역 위젯/오버레이/실시간 영역까지 함께 로드함
- 브라우저 측정 기준:
  - DOMContentLoaded 약 7.3s
  - FCP 약 9.5s
- 즉, 렉은 슬롯 자체만의 문제가 아니라 “슬롯 + 전체 레이아웃 과적재” 문제입니다.

### 메뉴 구조 확인
- 기존 `Imperial Zeus`는 현재 코드 검색상 남아 있지 않습니다.
- 별도 `슬롯` 메뉴와 하위 `슬롯 로비` / `Olympus 1000` 구조는 이미 들어가 있습니다.

## 수정 계획

### 1) 슬롯 오류 즉시 복구
- `src/lib/slots-rpc.ts`
  - 분리된 `rpc` 참조 제거
  - 모든 호출을 `supabase.rpc(...)` 직접 호출로 교체
  - 응답 타입/에러 매핑 정리
- `src/components/slots/OlympusSlot.tsx`
  - 보충/스핀 실패 메시지 세분화
  - `auth_required`, `game_not_found`, `bet_invalid` 등 누락 케이스 추가

### 2) 슬롯 페이지를 전용 경량 레이아웃으로 분리
- 목표: 슬롯 페이지에서 불필요한 HUD, 오버레이, 실시간 위젯, 플로팅 요소를 제거
- 변경 방향
  - `Layout` 재사용을 줄이거나
  - 슬롯 전용 `CasinoLayout` / `GameShell`을 만들어 `/casino`, `/casino/olympus-1000`에 적용
- 효과
  - 초기 로드 단축
  - 슬롯 화면 집중도 상승
  - unrelated RPC/렌더 비용 제거

### 3) 슬롯 UI를 계획한 구조로 재정렬
- `OlympusSlot.tsx`를 분해해 원 계획 구조에 가깝게 재구성
  - `SlotHeader`
  - `SlotControls`
  - `ModeToggle`
  - `WinOverlay`
  - `BuyBonusButton`
  - `SlotGameInfo`
- MVP 범위만 유지
  - Epic Win만 유지
  - Buy Bonus는 100x만 노출하되 prop 구조는 다중 옵션 확장 가능하게 정리

### 4) 렌더링 구조 최적화
- 릴 애니메이션 중 전체 그리드 재생성 방식 제거
- 최소 변경 원칙
  - reel/row 셀을 memo 처리
  - spinning 중에는 시각 효과만 움직이고 실제 결과 반영은 마지막 1회만 적용
  - 불필요한 `reelKey` 전체 재마운트 축소
- `prefers-reduced-motion` 반영
- 과한 glow/overlay 연산 정리

### 5) 계획 누락분 보완
- `FreeSpinWheel` MVP UI 추가
  - 8 세그먼트 표시
  - 실제 당첨 multiplier와 연결
- `useFakePlayerCount` 분리
  - 현재 인라인 로직을 훅으로 이동
- `/dashboard`에 카지노 진입 카드 추가
  - `/casino`로 연결
  - 현재 IA와 일관되게 배치

### 6) 계획과 실제 구현 차이 정리
- 승인된 계획 기준으로 “완료 / 부분완료 / 미완료”를 코드 기준 체크리스트로 정리
- 사용자가 다시 확인할 수 있게 결과를 명확히 보고

## 기술 상세
- 수정 파일 후보
  - `src/lib/slots-rpc.ts`
  - `src/components/slots/OlympusSlot.tsx`
  - `src/components/Layout.tsx` 또는 신규 `src/components/casino/CasinoLayout.tsx`
  - `src/pages/Casino.tsx`
  - `src/pages/casino/Olympus1000.tsx`
  - `src/pages/Dashboard.tsx`
  - 신규 보조 컴포넌트/훅 파일들
- 백엔드 상태
  - 슬롯 관련 RPC는 실제로 존재함
  - 호스팅 백엔드는 정상 응답 상태
  - 이번 핵심 오류는 프론트 호출 방식이 원인

## 완료 기준
- DEMO 보충 정상 동작
- DEMO 스핀 정상 동작
- REAL 스핀 호출 오류 제거
- 슬롯 진입 시 초기 로드/프레임 저하 눈에 띄게 감소
- 승인된 MVP 계획과 실제 구조 차이를 최소화
- 대시보드 → 카지노 → Olympus 1000 진입 동선 완성