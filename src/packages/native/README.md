# @pkg/native — Mobile Native Feel (Phase 4 Sprint 3)

iOS/Android 네이티브 느낌을 웹에서 재현. transform/opacity only, 60fps.

## 절대 규칙
- transform + opacity 외 애니메이션 속성 금지 (width/height/top/left/margin ❌)
- money-flow 8경로 / RPC / Edge function 직접 호출 금지 (순수 UX 레이어)
- 모든 hook/component throw-free (graceful degradation)
- `prefers-reduced-motion` 존중

## API

```ts
import {
  useHaptic, triggerHaptic,
  usePullToRefresh, useSwipeGesture,
  useDynamicIsland, dynamicIsland,
  DynamicIslandPill, PullToRefreshIndicator,
  NearMissOverlay, MultiplierCountUp,
} from "@/packages/native";
```

### Haptic
- `triggerHaptic("success")` — iOS Safari 미지원 시 silent no-op
- 강제 OFF: `localStorage["phonara:haptic:v1"] = "0"`

### Pull-to-Refresh
```tsx
const { ref, pull, busy, threshold } = usePullToRefresh<HTMLDivElement>({
  onRefresh: async () => { await qc.invalidateQueries(); },
});
return (
  <div ref={ref} style={{ position: "relative" }}>
    <PullToRefreshIndicator pull={pull} threshold={threshold} busy={busy} />
    {children}
  </div>
);
```

### Dynamic Island
앱 어디서나:
```ts
dynamicIsland.show({ kind: "success", text: "출금 완료", ttl: 2400 });
```
App 루트에 `<DynamicIslandPill />` 1회 마운트.

### Worker 연결
- `NearMissOverlay` → `calcNearMiss` (Sprint 2 worker, fallback 자동)
- `MultiplierCountUp` → `calcMultiplierFrames` (Float32Array transferable, fallback 자동)

## Verification
- bundle: framer-motion 신규 import 0 (index 청크 영향 0)
- 머니플로 / operator / imperial_* git diff = 0
