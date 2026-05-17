# 슬롯 사운드 타이밍 검증 + 새 mp3 실제 재생 연결

## 진단 (왜 "안 들리고 겹치는 느낌"인가)

현재 슬롯 페이지에는 **두 개의 사운드 시스템**이 병렬로 돌고 있습니다.

```text
[OlympusSlot.tsx — 실제 슬롯 UI]
        │
        ├─ SoundManager.playReelSpin()    ← 스핀 시작
        ├─ SoundManager.playReelStop()    ← 릴 정지
        ├─ SoundManager.playWinTier()     ← 승리
        └─ SoundManager.playBonusTrigger / playScatter
                  │
                  └─ src/lib/sound/SoundManager.ts  (LEGACY)
                        │
                        ├─ cache에 mp3 있으면 재생
                        └─ 없으면 procedural(합성음) 폴백 ← 지금 들리는 소리

[useSlotSound(slotId) — 슬롯 진입 시 마운트만]
        │
        └─ src/lib/sounds/SlotSoundManager.ts  (신규 FACADE)
                │
                ├─ /sounds/{slotId}/sfx/spin_start.mp3 등 Howl로 로드
                ├─ public/sounds/common/sfx/coin_drop.mp3 로드
                └─ public/sounds/common/sfx/big_win_trigger.mp3 로드
                        ↓
                  로드만 됨. **OlympusSlot은 이 facade를 호출하지 않음.**
```

결론:
- 17개 mp3는 정상적으로 다운로드되고 Howl 버퍼에 올라감
- 그러나 스핀/정지/승리 시점에 실제로 트리거되는 것은 **legacy procedural 합성음**
- 그래서 사용자에게는 "새 사운드는 거의 안 들리고, 기존 합성음과 겹치는 듯한" 인상

## 무엇을 할 것인가

### 1) 브리지 — 업로드한 mp3가 자동으로 올바른 타이밍에 재생되게

`SoundManager.play(cue, channel)` 내부에서 procedural 폴백 직전에
"공용/슬롯별 override 테이블"을 우선 조회하도록 한 줄짜리 라우팅을 추가합니다.

매핑 (사용자가 올린 17개 파일 기준):

| 슬롯 내부 cue (legacy)        | 새로 재생할 파일                                    | 타이밍                |
|-------------------------------|-----------------------------------------------------|-----------------------|
| `reel_spin` / `reel_spin_fast`| `/sounds/{slotId}/sfx/spin_start.mp3` (있을 때만)   | Spin 버튼 클릭        |
| `reel_stop`                   | `/sounds/common/sfx/coin_drop.mp3`                  | 마지막 릴 정지        |
| `win_big` / `win_huge`        | `/sounds/common/sfx/big_win_trigger.mp3`            | 베팅 ×10 이상 승리    |
| `win_mega` / `win_epic`       | (없음) → 기존 procedural 그대로                     | 베팅 ×200, ×500 이상  |

원칙:
- **있으면 mp3, 없으면 기존 procedural** (자동 폴백 유지)
- legacy `SoundManager`는 단일 진입점이므로, 한 곳만 손대면 모든 슬롯에 적용
- 새 facade(`SlotSoundManager`)는 그대로 두되 BGM/사전 로딩 책임만 유지 → **겹침 제거**
- money-flow / Operator Isolation / Bundle Budget / Realtime 무관 (사운드 레이어 한정)

### 2) 검증 — 실제 타이밍 테스트

두 단계로 확인합니다.

**A. Dev 사운드 테스트 패널** (DEV 빌드에서만 노출)
- `src/components/dev/SoundTimingPanel.tsx` 신규
- 슬롯 페이지 우하단에 작은 플로팅 패널 (production 자동 제거)
- 버튼 4개: `spin_start`, `coin_drop`, `big_win_trigger`, `legendary`
- 각 버튼 누르면 현재 재생 경로(mp3 파일 URL 또는 "procedural") + 길이(ms)를 패널에 표시
- 사용자가 직접 "이 슬롯에서 이 소리가 이렇게 들린다"를 한눈에 확인

**B. 자동 회귀 (헤드리스 검증)**
- `scripts/check-slot-sound-routing.mjs` 추가
- 17개 mp3 파일이 `public/sounds/**` 에 실제 존재하는지 + `SLOT_SOUND_MAP` 매핑이 일치하는지 정적 검사
- CI 노이즈 방지를 위해 npm script로만 노출 (PR 게이트 X)

타이밍 자체(실제 오디오 출력)는 브라우저 자동화로 mp3 디코딩까지 검증하기 어렵습니다.
대신 (A) 패널로 사용자가 직접 슬롯 한 번 돌려보고 다음 3가지를 확인하시면 됩니다:
1. Spin 누른 순간 → 슬롯별 `spin_start.mp3` 1회
2. 릴 마지막 정지 → `coin_drop.mp3` 1회 (procedural 합성음과 겹치지 않음)
3. 큰 승리 → `big_win_trigger.mp3` (작은 승리는 기존 procedural 유지)

## 변경 파일 요약

- 수정: `src/lib/sound/SoundManager.ts` — `play()` 메서드에 override 라우팅 1블록 추가 (~15줄)
- 신규: `src/lib/sound/cueOverrides.ts` — 위 매핑 테이블 (정적 상수)
- 신규: `src/components/dev/SoundTimingPanel.tsx` — DEV 전용 플로팅 패널
- 수정: `src/components/slots/SlotSignatureWrapper.tsx` — `<SoundTimingPanel />` 마운트 (import.meta.env.DEV 가드)
- 신규: `scripts/check-slot-sound-routing.mjs` — 정적 파일 존재 검사

## 절대 불변
- money-flow 8경로 git diff = 0
- Operator Isolation / Bundle Budget / Active Governor / Realtime wrapper 무손상
- 기존 procedural 폴백 동작 그대로 (mp3 없으면 지금과 동일)
- `OlympusSlot.tsx` 무수정 (기존 호출 시그니처 유지)
