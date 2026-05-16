# Sugar Fever 3000 — 캔디 테마 완전 정리

Olympus 잔재를 모두 제거하고 파스텔 캔디 럭셔리 룩으로 4개 파일을 일관되게 재정렬합니다. 엔진/다른 슬롯은 건드리지 않습니다.

## 변경 파일

1. **src/components/slots/SugarFeverCanvas.tsx** — 완전 재작성
   - 배경: 크림 핑크 → 라벤더 → 민트 베이지 3-stop 라디얼 그라데이션
   - 2-layer 패럴랙스: 상단 파스텔 슈가 클라우드, 하단 마카롱/케이크 실루엣
   - 상단에 초콜릿 드립 리본, 떠다니는 wrapped candy / 롤리팝 / 스프링클 dots
   - Olympus 마블/번개/골드빔 잔재 grep 후 0건 확인
   - 단일 RAF, DPR cap=2, `prefers-reduced-motion` 정적 폴백

2. **src/components/celebration/SugarFeverMaxWinOverlay.tsx** — 재구현
   - 중앙 거대 회전 롤리팝 스월(SVG conic gradient) + 캔디 크라운
   - 초콜릿 스플래시 아크, 컨페티(파스텔 핑크/민트/골드/라벤더) 250+
   - 모바일 `navigator.hardwareConcurrency` 기반 파티클 throttle, GPU transform only
   - "3000x SUGAR RUSH" 카피 + slow-mo + 스크린 셰이크

3. **src/components/slots/themes.ts** — `SUGAR_FEVER_THEME` 전면 갱신
   - `reelFrameClass`: 크림 핑크-골드 더블 보더 + soft shadow
   - `spinStreakClass`: 파스텔 핑크 글로우
   - `cardFilter`: `hue-rotate(310deg) saturate(1.15)` 유지 + brightness 조정
   - `reelPattern`: `SUGAR_FEVER_PATTERN` 캔디 도트 격자 재확인
   - 모든 Olympus 색상 토큰 참조 제거

4. **src/components/slots/SugarFeverPaytableSheet.tsx** — 시각 일관성
   - 심볼 칩 배경을 파스텔 캔디 그라데이션으로 통일
   - Rainbow Swirl / Mint Macaron / Golden Lollipop(scatter) / Multiplier Bomb 설명 톤 정리
   - 헤더/구분선 색상도 핑크-골드 팔레트로

## 기술 노트

- 색상은 컴포넌트 내 inline `hsl()` 리터럴 (캔디 팔레트 전용, 전역 토큰 영향 없음)
- 기존 8개 슬롯, OlympusSlot 엔진, SlotSignatureWrapper 무수정
- 새 DB/사운드/에셋 추가 없음 (사운드 팩은 placeholder 유지)
- 변경 후 `OlympusLegacyCanvas`, 다른 슬롯 페이지 영향 0건 확인
