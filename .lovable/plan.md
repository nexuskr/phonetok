# Fix: 패키지 페이지 스크롤·CTA 먹통 (재진단)

이전 수정이 통하지 않은 이유를 다시 코드로 확인한 결과 **버튼들이 "먹통"인 게 아니라 같은 `/packages` 페이지 안에서 `navigate("/packages?focus=...")`로 점프해 시각적 변화가 없어 클릭이 무시된 것처럼 보이는 문제**, 그리고 **`등급 비교 한 장으로 보기` 다이얼로그가 shadcn `DialogContent` 기본값(스크롤 없음, max-h 없음)** 이라는 두 가지가 핵심입니다.

---

## 1. `/packages` 안에서 "패키지 보기" 버튼이 먹통으로 보이는 문제 (가장 큰 원인)

`PackageUpgradeCards.tsx`의 잠금 카드 CTA(스타터 패키지 보기 / 50만원 / 150만원 / Empire / Elite / Phantom 패키지 보기)는 모두 다음을 호출합니다:

```ts
navigate(`/packages?focus=${focus}`)
```

이미 `/packages`에 있기 때문에 **URL만 바뀌고 화면은 그대로** → 사용자에게는 "버튼이 안 먹힘"으로 보임.

### 수정
- **`src/components/empire/PackageUpgradeCards.tsx`**
  - `goToPackage`: 현재 경로가 `/packages`면 `navigate` 대신 `document.getElementById(`pkg-${focus}`)?.scrollIntoView({behavior:"smooth", block:"center"})` 후 1.6초 골드 링 펄스(`data-flash`)만.
  - `focus` 키와 `PACKAGES`의 `id` 매핑 테이블(`easy_starter` → `starter`, `easy_50` → `easy50`, `easy_150` → `easy150`, `empire` → `empire`, `empire_elite` → `elite`, `phantom` → `phantom`) — 실제 PACKAGES id는 `code--view`로 한 번 더 확인 후 정확히 매핑.
- **`src/pages/Packages.tsx`**
  - 각 카드 외곽 `<div>`에 `id={`pkg-${p.id}`}` 추가.
  - 마운트 시 `useSearchParams`의 `focus` 읽어 동일하게 스크롤 + 펄스(이미 매핑된 카드로).
  - 펄스는 1.6초 후 `setTimeout`으로 제거(아주 가벼운 state 토글).

---

## 2. `등급 비교 한 장으로 보기` 다이얼로그 스크롤 안 됨

`src/components/ui/dialog.tsx`의 `DialogContent`는 `max-h`/`overflow` 미설정 → 모바일에서 매트릭스가 화면 밖으로 잘리고 다이얼로그는 fixed translate로 중앙 고정이라 페이지 스크롤로도 못 봄.

### 수정 (call-site만 손대고 공용 shadcn은 건드리지 않음)
- **`src/components/empire/PackageUpgradeCards.tsx`** line 315
  - `<DialogContent className="max-w-3xl">` →
    `<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto overscroll-contain">`
  - `TierBenefitMatrix` 래퍼에 `min-w-0`만 추가(가로 스크롤 차단). 가로 표가 넓으면 그 내부에 `overflow-x-auto` 한 겹.

---

## 3. PurchaseModal X 닫기 보강(보조)

이미 `z-[70]` + ESC + backdrop click이 들어가 있으나, X 위치 영역에 `-top-20 -right-20 w-40 h-40` 블러 장식이 **`pointer-events-none` 없이** 겹쳐 있어 일부 기기에서 클릭이 장식에 먹힐 수 있음.

### 수정
- **`src/pages/Packages.tsx`** line 282
  - `<div className="absolute -top-20 -right-20 ... blur-3xl opacity-50" />`
    → 같은 div에 `pointer-events-none` 추가.

---

## 4. 검증

- `browser--navigate_to_url` → `/packages` (모바일 360×800)
  - "스타터 패키지 보기" 클릭 → 해당 카드로 부드럽게 스크롤 + 골드 펄스
  - "Empire 패키지 보기" 동일 확인
  - "등급 비교 한 장으로 보기" → 다이얼로그 내부 스크롤 정상, X 닫힘
  - 일반 패키지 카드 "지금 시작" → PurchaseModal 열림 → X 클릭 시 닫힘
- 콘솔 에러 0

---

## 기술 메모

- 라우팅·비즈니스 로직 변경 없음. 모두 프론트엔드 프레젠테이션 한정.
- shadcn 공용 컴포넌트(`ui/dialog.tsx`)는 건드리지 않음 — 다른 다이얼로그 영향 없음.
- 펄스 효과는 Tailwind `ring-2 ring-gold animate-pulse` + setTimeout 토글.
