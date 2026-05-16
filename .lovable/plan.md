# PR-H Idle/Hidden Suspension — 회귀 수정

## 현재 시나리오 결과
- `activeRPC: 5` (정상)
- `hiddenRPC: 1` — FAIL (`platform_kill_switches` 1회 유출)
- `idleRPC: 5` — FAIL (cosmetic 4개 + admin 1개 전부 유출)

## 원인
1. **Idle**: `runtime.idle.installIdleSuspension()`이 `pauseCategory("admin")`만 호출합니다. `use-auth-live-data`의 4개 폴링(KPI, whale, top5, 1s drift)은 `category: "cosmetic"` 이므로 idle 단계에서 계속 발사됩니다.
2. **Hidden**: `setVisibleInterval`은 `document.hidden`과 governor를 모두 가드하지만, `use-kill-switches`의 두 가지 비-interval 경로가 가드되지 않습니다:
   - Supabase realtime `postgres_changes` 콜백 → `refresh()` 직접 호출
   - `window` `focus` 이벤트 → `refresh()` 직접 호출 (시나리오가 visibility를 토글할 때 트리거될 가능성)

## 변경안

### A. Idle 정책 확장 (정답으로 추천)
`runtime.idle.ts`를 수정해 60초 입력 없음이 감지되면 **`admin` + `cosmetic` 둘 다** 일시정지하도록 변경. 입력 복귀 시 둘 다 resume.

근거: 탭이 visible이라도 60초간 입력이 없으면 화면을 능동적으로 보지 않는 상태이므로 cosmetic 폴링/마키 갱신을 멈춰도 UX 손실이 없고, 입력 한 번에 즉시 catch-up이 일어납니다. `useDocumentVisible`/Realtime은 영향 없습니다.

대안 (선택하면 알려주세요):
- **B**. `use-auth-live-data`만 `category: "admin"`으로 재분류 — 좁은 수정이지만 `/secure-auth` 외 다른 cosmetic 폴링은 idle에 계속 살아남음.
- **C**. 새 카테고리 `"idle-suppressible"` 도입 — 코드 양 가장 많음, 비추천.

### Hidden 누수 차단 (A/B/C 공통)
`use-kill-switches.ts`의 `refresh()` 호출 시 가드 추가:
```ts
function refresh() {
  if (typeof document !== "undefined" && document.hidden) return;
  if (isCategoryPaused("admin")) return;
  // ...
}
```
- realtime 콜백/focus 핸들러 모두 자동으로 보호됨.
- realtime 이벤트는 무시되지만, visible 복귀 시 `setVisibleInterval` catch-up과 `focus` 리스너가 1회 즉시 refresh 하므로 일관성 유지.

## 변경 파일
- `src/packages/runtime/runtime.idle.ts` — `tick()`/`markActive()`/`__phonaraIdle.force()`에서 `admin` + `cosmetic` 둘 다 pause/resume.
- `src/hooks/use-kill-switches.ts` — `refresh()` 첫 줄에 hidden + admin paused 가드 추가, `isCategoryPaused` import.

## 검증
1. `bun run build`
2. `__phonaraSurface.runScenario()` 실행
3. 기대 결과: `verdict.hidden === "PASS"`, `verdict.idle === "PASS"`, `hiddenRPC=0`, `idleRPC=0`
4. 통과 시 `reports/rpc.surface.2026-05-16.json`에 결과 저장
