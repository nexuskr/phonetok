# React #310 오류 수정 계획

현재 오류는 React #310, 즉 `Rendered more hooks than during the previous render`로 보입니다. 어드민과 대시보드 양쪽에서 공통으로 터지는 이유는 여러 공용 화면에 조건부 `return` 뒤에 훅이 남아 있는 패턴이 확인됐기 때문입니다.

## 무엇을 수정할지

1. 공통 원인 제거
- `src/pages/Dashboard.tsx`에서 `if (!user) return null;` 뒤에 있는 `useMyPower`, `useOnline` 호출을 훅 규칙에 맞게 재배치합니다.
- `src/pages/admin/_AdminLayout.tsx`에서 `if (!user) return null;` 뒤에 있는 `useMemo`, `useEffect`를 훅 순서가 항상 고정되도록 재구성합니다.
- 필요하면 `src/pages/Admin.tsx` 포함 어드민 관련 화면도 같은 패턴을 점검해 같은 방식으로 정리합니다.

2. 안전한 구조로 리팩터링
- 모든 훅은 컴포넌트 최상단에서 항상 동일한 순서로 호출되게 통일합니다.
- 인증/권한 가드는 훅 호출 이후에 렌더 분기만 하도록 바꿉니다.
- 비인증 상태에서 무거운 훅이 불필요하게 실행되지 않도록, 훅 내부 또는 인자에서 `enabled`/guard 패턴을 쓰는 방식으로 정리합니다.

3. 공통 재발 방지
- 대시보드/어드민 공용 레이아웃과 주요 페이지에서 같은 유형의 조건부 훅 패턴을 추가 점검합니다.
- 이번 오류와 같은 패턴이 다시 생기지 않도록 early return 위치를 일관되게 정리합니다.

4. 검증
- `/command`와 `/admin` 진입 시 더 이상 에러 바운더리 화면이 뜨지 않는지 확인합니다.
- 콘솔에 React #310 관련 오류가 사라졌는지 확인합니다.
- 인증 전환/리로드/라우트 이동에서도 동일 오류가 재발하지 않는지 확인합니다.

## 기술 메모
- React 훅은 렌더마다 같은 개수와 같은 순서로 호출되어야 합니다.
- 현재 코드상 특히 아래 두 곳이 강한 원인 후보입니다.
  - `src/pages/Dashboard.tsx`
  - `src/pages/admin/_AdminLayout.tsx`
- 이 두 곳은 공통 진입점 성격이라, 여기만 바로잡아도 대시보드와 어드민 양쪽 증상이 함께 사라질 가능성이 높습니다.