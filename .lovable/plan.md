
# 슬롯 3종 — Demo/Real 완전 분리 + 변동성 차별화 플랜

## 0. 원칙 (절대 위반 금지)

| 축 | Demo Mode | Real Mode |
|---|---|---|
| 자금 | `slot_demo_balances.balance_chips` (가상) | `phon_balances` (실 PHON 차감) |
| RPC | `spin_slot_demo` | `spin_slot_real` |
| RTP 밴드 | 98.5% ~ 101.5% | 94.8% ~ 95.8% |
| 스트릭 부스트 | 허니문 8스핀 + 연승 +22~38% + 9연승 강제 보너스 | 최근 10스핀 누적 +8% 상한 |
| 보너스 구매 | 1.85× 페이아웃 부스트 | 정상 배율 (게임별 buy_bonus_multiplier) |
| 안전 가드 | RTP > 100.5% & payout > 5× → 1~3× 캡 | RTP > 95.8% & payout > 50× → 50× 하드 캡 |
| 부스트 입력 | 없음 (가상 칩) | NFT boost_pct + VIP 가산 |
| 히스토리 | `slot_demo_spins` | `slot_spins` |
| UI 마킹 | `<DemoBadge />` 노란 띠 + "DEMO" 배지 | 골드 PHON 배지 |
| 모드 전환 | 잔고/스트릭/히스토리 캐시 완전 초기화 | 동일 |

3종 슬롯은 **단 하나의 엔진(`_slot_compute_spin` + `spin_slot_demo/real`)**을 공유. 차이는 **`slot_games` 테이블의 페이테이블/변동성 파라미터**와 **클라 테마(아트/사운드/이펙트)**로만 발생.

---

## 1. 데이터베이스 변경 (마이그레이션 1건)

### 1-A. `slot_games` 시드 확장

```text
olympus_1000  | 중변동 | RTP 96 | MAX 1000× | bonus_freq 1/180 | buy_bonus 100×
wizard_2000   | 고변동 | RTP 96 | MAX 2000× | bonus_freq 1/280 | buy_bonus 150×
dragon_500    | 저변동 | RTP 96 | MAX 500×  | bonus_freq 1/120 | buy_bonus 60×
```

신설 컬럼:
- `volatility_class text` — `low|mid|high`
- `bonus_frequency int` — 평균 N스핀당 1회
- `paytable jsonb` — 11심볼 × 3·4·5매치 배율표
- `symbol_weights jsonb` — 릴 가중치 (저변동=고배율 가중↓, 고변동=고배율 가중↑)

3행 UPSERT (시드).

### 1-B. RTP/페이아웃 캡 재조정

`spin_slot_demo`: 기존 99.3~100.8 → **98.5~101.5** 밴드, 캡 트리거 조건 갱신.
`spin_slot_real`: 기존 94.8~95.6 → **94.8~95.8** 밴드, 50× 하드캡 명시 + NFT boost_pct + VIP 보정 합산을 `_slot_compute_spin` 호출 인자로 위임.

### 1-C. `_slot_compute_spin` 시그니처 확장

`p_paytable jsonb`, `p_symbol_weights jsonb`, `p_max_multiplier numeric`을 받아 게임별 페이테이블 적용. 기존 호출부 모두 `slot_games` row에서 읽어 전달.

### 1-D. 인덱스
`slot_spins(user_id, game_code, created_at desc)` 부분 인덱스 (Real 모드 스트릭 계산용).

---

## 2. 프론트엔드 — 모드 분리 리팩토링

### 2-A. `OlympusSlot.tsx` 해체 → 4 파일

```
src/components/slots/
  ├ engine/
  │   ├ types.ts             // SpinResult, GameConfig, ModeState
  │   ├ useSlotDemo.ts       // demo 잔고·스트릭·히스토리·spin
  │   ├ useSlotReal.ts       // real PHON·NFT부스트 표시·spin·optimistic
  │   └ useSlotMode.ts       // 모드 전환 + 상태 초기화 단일 책임
  ├ SlotMachine.tsx          // 공용 셸: 릴 + 잔고 표시 + 베팅 컨트롤
  ├ themes/
  │   ├ olympusTheme.ts      // 아트/팔레트/사운드/이펙트 강도
  │   ├ wizardTheme.ts
  │   └ dragonTheme.ts
  └ overlays/ (기존 유지, 테마 prop 받게 변경)
```

핵심: `<SlotMachine theme={…} gameCode="…" />` 한 컴포넌트 + `mode` 상태에 따라 `useSlotDemo()` 또는 `useSlotReal()` 훅이 활성화. 모드 전환 시 비활성 훅은 cleanup.

### 2-B. 모드 전환 안전성

`useSlotMode`가:
1. spinning 중이면 전환 차단 (토스트)
2. 전환 시 `displayBalance`, `winLines`, `winOverlay`, `streak`, `lastResult` 모두 리셋
3. 활성 RPC 추적 → 모드 변경 후 도착하는 stale response 폐기
4. `localStorage`에 마지막 모드 기억 (게임별)

### 2-C. `slots-rpc.ts` 분리

```
src/lib/slots/
  ├ rpc-demo.ts   // spinDemo, getDemoBalance, claimDemoRefill
  ├ rpc-real.ts   // spinReal, getPhonBalance(via useMyPower)
  └ types.ts
```

기존 `slots-rpc.ts`는 두 모듈을 re-export하여 호환성 유지.

---

## 3. 슬롯별 차별화

### Olympus 1000 (중변동) — 기존 유지·리팩토링만
- 아트: 그대로
- 사운드: 그대로
- 페이테이블: 현행 → DB로 이전
- 부스트 효과: 현행 골드 번개

### Wizard 2000 (고변동) — 신규
- **AI 심볼 11종 신규 생성**: 10/J/Q/K/A + Crystal Ball / Spell Book / Owl / Wizard Hat / **Wizard(emperor 등가)** / Wild=Pentagram / Scatter=Star Rune
- 배경/로고 신규
- 팔레트: 보라+청록 (`hsl 270 / 180`), 보석 글로우
- 사운드: 영창(chant) 루프 + 스펠 캐스팅 SFX
- 페이테이블 튜닝: 5매치 최고배율 250×, MAX 2000× (보너스 ×8 발동 시), 보너스 빈도↓
- "1/280 보너스이지만 터지면 크다" 카피

### Dragon Empire 500 (저변동) — 신규
- **AI 심볼 11종 신규 생성**: 10/J/Q/K/A + Pearl / Sword / Phoenix / Tiger / **Dragon(emperor 등가)** / Wild=Yin-Yang / Scatter=Drum
- 배경/로고 신규
- 팔레트: 적색+금색 (`hsl 0 / 45`), 옻칠 텍스처
- 사운드: 동양 타악기 + 용 울음
- 페이테이블 튜닝: 5매치 최고배율 80×, MAX 500×, 보너스 빈도↑(1/120), 잔잔한 연속 당첨
- "꾸준히 당겨지는 운영형 슬롯" 카피

`themes/*.ts`가 색·이펙트 강도·승리 사운드 트랙·파티클 컬러 토큰을 노출 → `<SlotMachine>`이 디자인 토큰만 swap.

---

## 4. 라우팅·로비

```
/casino                 → Casino.tsx (3종 카드)
/casino/olympus-1000    → <SlotMachine theme={olympus} gameCode="olympus_1000" />
/casino/wizard-2000     → <SlotMachine theme={wizard}  gameCode="wizard_2000" />
/casino/dragon-empire   → <SlotMachine theme={dragon}  gameCode="dragon_500" />
```

`Casino.tsx` 카드의 `to` 경로를 `/casino/dragon-empire`로 통일(현재 `dragon_500` 코드 노출 제거).

---

## 5. QA 체크리스트 (구현 후)

1. Demo→Real 전환 직후 첫 스핀이 실제 PHON을 정확히 차감하는지
2. Real→Demo 전환 후 demo 잔고 표시가 즉시 정확
3. 스핀 진행 중 모드 토글 차단 토스트
4. 3 슬롯 각각 100 spin 시뮬레이션 RPC 호출로 RTP 밴드 들어오는지 (개발 콘솔 스크립트)
5. Wizard buy-bonus가 Demo에서 1.85× 부스트, Real에서 정상 ×150 만 적용
6. 50× 하드캡: Real에서 의도적으로 streak boost 풀로 채워도 50× 초과 없는지
7. 모바일 60fps 유지 (3 테마 모두 파티클 동일 budget)

---

## 6. 산출물 및 안내 문구

- Migration 1건 (slot_games 시드 + RPC 갱신 + 인덱스)
- 신규 파일: 4 hooks/engine + 3 themes + Wizard/Dragon 페이지 2개
- 아트: `src/assets/slots/wizard/` `src/assets/slots/dragon/` (각 13개 파일: 11 심볼 + bg + logo)
- `OlympusSlot.tsx`는 thin wrapper (`<SlotMachine theme={olympus} />`)로 축소
- 완료 후 출력: **"Wizard 2000 and Dragon Empire completed with distinct volatility and paytable while sharing core engine"**

---

## 7. 작업 순서 (큰 덩어리)

1. DB 마이그레이션 (paytable jsonb + 시드 + RPC 시그니처)
2. `engine/` + `SlotMachine.tsx` 추출, Olympus 회귀 테스트
3. `themes/olympusTheme.ts` 분리
4. AI 아트 생성 (Wizard 13개 → Dragon 13개, 각 batch)
5. `themes/wizardTheme.ts` + `themes/dragonTheme.ts` + 페이지 2개
6. Casino 로비 라우팅 정리
7. QA 시뮬레이션 + 완료 메시지

승인하시면 위 순서대로 1단계 마이그레이션부터 시작합니다.
