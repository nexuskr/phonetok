# Phase D — Avatar v3 + Virtual Lobby v3 (Meta OS Core)

세계 1위 모바일 OS-like 가상세계의 핵심: 12파츠 커스터마이징 아바타 + 2.5D 가상 로비를 구축한다. 모든 신규 코드는 lazy chunk로 격리되며 money-flow 8경로 / Operator Isolation / Bundle Budget을 0바이트도 건드리지 않는다.

## 사용자에게 보이는 것

- `/avatar/studio` — 12파츠(헤어/얼굴/눈/입/상의/하의/신발/장갑/망토/이펙트/배경/칭호) 드래그&드롭 커스터마이저. 실시간 3D 미리보기, PHON 가격, Legendary/Epic 잠금 표시, "이 모습은 오직 나, 폐하만의 것" 카피.
- `/lobby` — 2.5D 가상 로비. 다른 황제 아바타 최대 160명이 InstancedMesh로 떠다님. Crown/VIP 글로우, breathing 애니메이션, 가까이 가면 "👑 황제 입장" Warm King 토스트.
- Bottom Nav 위 floating 로비 버튼 (mobile-first).

## 작업 항목

1. **deps** — `three@^0.160`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122` 추가 (React 18 호환 버전 고정).
2. **DB 마이그레이션** (`avatar_parts`, `user_avatar_loadout`, `user_avatar_parts_owned`)
   - 12개 slot enum, rarity, price_phon, asset_url
   - RPC: `get_avatar_parts_catalog`, `get_my_avatar_loadout`, `equip_avatar_part`, `purchase_avatar_part` (기존 PHON 차감 패턴 재사용, money-flow 함수는 미수정)
   - RLS: 본인만 SELECT/UPDATE 자기 loadout
3. **`src/components/avatar/v3/`**
   - `Avatar3D.tsx` — single avatar, InstancedMesh 친화, LOD 2단계, Frustum culling.
   - `AvatarStudio.tsx` — 12 slot tabs + 드래그&드롭, 실시간 preview, PHON 구매 다이얼로그.
   - `useOptimizedAvatar.ts` — 텍스처/지오 캐시, safeDispose.
   - `useContextRecovery.ts` — `webglcontextlost/restored` 리스너 + loadout 재바인딩.
4. **`src/components/lobby/v3/`**
   - `VirtualLobby3D.tsx` — 2.5D 정사영 카메라, low-power 렌더러, 160 InstancedAvatarManager.
   - `InstancedAvatarManager.ts` — InstancedMesh + breathing shader uniform.
   - `useVirtualLobby.ts` — supabase `useLobbyChannel` (presence partition `chat:lobby`)로 in-room 사용자 broadcast (money-flow 외 신규 partition key).
   - `ProximityFomoToast.tsx` — 30s 디듀프, "👑 황제 폐하 입장" notify.warmKing.
5. **라우팅** — `App.tsx`에 `React.lazy` 로 `/avatar/studio`, `/lobby` 추가. Bottom Nav에 floating Lobby FAB (mobile only).
6. **모바일 최적화**
   - `WebGLRenderer({ antialias:false, powerPreference:"low-power" })`, `pixelRatio = Math.min(devicePixelRatio, 2)`.
   - `useDeviceProfile()==="low"` → 2D fallback (정적 PNG 그리드).
   - 모든 dispose는 `safeDispose(obj)` 유틸 1곳에서.
7. **카피/톤** — 모든 문구 Warm King (`@/lib/notify`, `g()` glossary). 개발자 용어 0.
8. **메모리/문서** — `mem://features/avatar-lobby-v3` + index.md 추가.
9. **검증**
   - `node scripts/check-money-flow-freeze.mjs` PASS
   - `node scripts/check-operator-isolation.mjs` PASS
   - `npm run size:check` PASS (avatar/lobby 청크 ≤120KB gzip, index 영향 0)
   - 시뮬레이션: 디바이스 mid에서 60fps, low에서 fallback 진입 확인.

## 기술 세부

```text
src/
  components/
    avatar/v3/   (Avatar3D, AvatarStudio, parts/, hooks/)
    lobby/v3/    (VirtualLobby3D, InstancedAvatarManager, ProximityFomoToast)
  pages/
    AvatarStudio.tsx  (lazy)
    Lobby.tsx         (lazy)
```

- three / fiber / drei 는 lazy route 안에서만 import → manualChunks 자동 분리, index 청크 영향 0.
- VR/WebXR 의존성 0. Pure PWA.
- Realtime은 기존 `@pkg/realtime` 4-partition 래퍼만 사용. `supabase.channel` 직접 호출 금지 (ESLint 가드 적용).
- money-flow 8경로 파일 수정 0. PHON 차감은 기존 `purchase_avatar` 패턴을 모방한 새 RPC `purchase_avatar_part` 로 처리 (신규 SECURITY DEFINER, baseline 등록).

## 범위 외 (이번 PR 아님)

- 실시간 채팅, 거래, 미니게임 로비 통합
- WebXR/VR
- 음성/3D 오디오
- 친구 초대/파티 시스템
