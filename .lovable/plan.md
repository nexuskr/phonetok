# Cosmic Forge 5000 — Signature Slot 마감 플랜

OlympusSlot 공용 엔진은 그대로 두고, Cosmic Forge 5000 페이지 위에 **테마 전용 레이어**를 얹어 시그니처 슬롯으로 마감합니다. 다른 슬롯에 영향 없음.

## 범위 (이번 작업에서 할 것)

1. **Cosmic Visual Skin (페이지 전용)**
   - `CosmicForge5000.tsx`를 wrapper화: 배경 nebula 캔버스(드리프트하는 별 + 보라/시안 글로우), Logo 위 펄싱 코로나, 좌우 가장자리 cosmic light flare(저강도, 항상 ON).
   - `OlympusSlot`은 그대로 사용. `COSMIC_FORGE_THEME`에 reel border/spinStreak를 보라-시안 듀얼톤으로 미세 강화 (다른 테마 무영향).
   - GPU 친화: `transform3d/will-change` 사용, `prefers-reduced-motion` 시 정지.

2. **Cosmic Symbol & Paytable 정리**
   - 기존 `src/assets/slots/cosmic/sym_*.png` 6종 + 저가 카드 4종(A/K/Q/J — 공통)으로 일관 표기.
   - 신규 컴포넌트 `src/components/slots/CosmicPaytableSheet.tsx`: 모바일 친화 Sheet(테마 전용), 심볼/배당/와일드/스캐터/보너스 설명. 페이지 우측 상단 "배당표" 버튼으로 오픈.

3. **Win Celebration — Cosmic 전용 레이어**
   - 기존 `WinCelebrationOverlay`는 그대로 둠.
   - 신규 `src/components/celebration/CosmicMaxWinOverlay.tsx`: 5000× 도달 또는 multiplier ≥ maxMultiplier 시 추가 풀스크린 cinematic (Galaxy Explosion + Emperor 칭호 + Cosmic Edge Flare 강화). `useWinCelebration` 구독해서 mult≥theme.maxMultiplier일 때만 트리거.
   - 3초 cap, 모바일은 파티클 수 절반.

4. **Cosmic Forge 페이지 통합**
   - 위 컴포넌트를 `CosmicForge5000.tsx`에 마운트. `useSlotSound("cosmic_forge")` 유지.
   - Paytable 버튼은 OlympusSlot 외부 헤더 영역에 둠 (엔진 변경 없음).

5. **Dev Cheat Panel (production 자동 숨김)**
   - 신규 `src/components/slots/DevWinCheats.tsx`: `import.meta.env.DEV`일 때만 렌더. Big/Mega/Epic/Legendary/MAX 5000× 버튼 → `WinCelebrationManager.triggerWin(...)` 직접 호출 (실제 베팅 미발생, 데모 검증용).

6. **터치 피드백**
   - `CosmicForge5000.tsx` Spin/Bet 등 외곽 컨트롤 영역에 `active:scale-[0.98]` + `navigator.vibrate(8)` (지원 시).

## 손대지 않는 것

- `OlympusSlot.tsx` 코어 엔진 (다른 9개 슬롯 공유 — 회귀 위험).
- RPC/RTP/페이아웃 로직 (서버 권한 — Demo/Real RTP는 백엔드 RPC가 결정. 이번 작업은 클라 표기/연출만).
- 다른 슬롯 페이지 / 공용 SoundManager / 공용 WinCelebrationManager.

## 기술 메모

- Nebula 캔버스: `requestAnimationFrame` + 페이지 hidden 시 일시정지(`visibilitychange`), 60 별 cap, devicePixelRatio 1로 고정.
- MaxWin 트리거 조건: `mult >= theme.maxMultiplier * 0.999` (서버 라운딩 안전마진).
- Cheat 버튼: production 빌드에서 트리 셰이킹되도록 `if (!import.meta.env.DEV) return null` 최상단 가드.
- 사운드/셀러브레이션 시스템은 facade 통해서만 호출 — 기존 계약 유지.

## 결과물 (신규/수정 파일)

신규:
- `src/components/slots/CosmicPaytableSheet.tsx`
- `src/components/celebration/CosmicMaxWinOverlay.tsx`
- `src/components/slots/DevWinCheats.tsx`
- `src/components/slots/CosmicNebulaCanvas.tsx`

수정:
- `src/pages/casino/CosmicForge5000.tsx` (wrapper 구성)
- `src/components/slots/themes.ts` (COSMIC_FORGE_THEME 보라-시안 톤 미세 조정만)

## 다음 단계 (이번 작업 외)

- 동일 패턴(테마 wrapper + 전용 MaxWin overlay + Paytable Sheet)을 Neon Tokyo 88로 복제할 수 있도록 `SlotSignatureWrapper` 추출 — 본 작업 완료 검증 후 별도 작업으로 분리.
