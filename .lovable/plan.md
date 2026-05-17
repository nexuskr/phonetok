# Sidebar Slim + Slice 7.5 Final Visual Touch

작업 범위: 좌측 사이드바 슬림화 + Dashboard/Landing/Navigation의 Imperial Luxury polish.
새 기능/새 컴포넌트/새 라우트 추가 없음. 오직 시각 정리 + CSS 강화.

## 1. 좌측 사이드바 슬림화 (`src/components/Layout.tsx`)

기존 5그룹 아코디언(`GROUPS`, `GroupedMenu`) 완전 제거 후, 평탄한 단일 리스트로 교체:

```text
Home    → /command
Trade   → /trade
Slots   → /casino
Live    → /live (없으면 /games)
Wallet  → /wallet
Empire  → /empire
─────────────
Admin   → /admin   (isAdmin 일 때만, 최하단 별도 섹션)
```

- Accordion / AccordionItem / GROUPS 상수 / GroupedMenu 컴포넌트 삭제.
- 모바일 sheet도 동일한 평탄 리스트를 재사용.
- 활성 항목은 gradient-imperial + glow, 비활성은 muted hover만.
- 아이콘은 lucide: Home, TrendingUp, Zap, Radio, Wallet, Crown, ShieldCheck.

## 2. Dashboard 폴리시 (`src/pages/Dashboard.tsx`)

기능/구성 그대로, 카탈로그 카드들에 Imperial Luxury 시각만 강화:

- 게임 카드: `hover:-translate-y-1`, ring gradient, 내부 radial glow, 더 깊은 shadow.
- 카테고리 칩: active 시 `bg-gradient-imperial` + 부드러운 glow pulse.
- Hero 영역: 배경에 은은한 imperial radial gradient + 미세한 noise overlay.
- Trading entry card: 상시 breathing glow (2.4s ease-in-out).

## 3. Landing 폴리시 (`src/pages/Landing.tsx`)

- Hero 타이틀: gradient-imperial 텍스트에 glow drop-shadow 강화.
- 주 CTA 버튼: hover scale 1.03 + 골드 halo pulse.
- (Phase 0-R에서 제거된 Live Wins Rail은 재추가하지 않음 — "마운트된 것"만 polish.)
- 신뢰 3줄: 골드 underline 미세 shimmer.

## 4. Navigation 폴리시 (`src/components/nav/PhonaraNav.tsx`)

- Bottom nav 항목: active 시 아이콘 위에 작은 골드 dot + glow halo.
- 비활성 → 활성 전환: 200ms scale 1→1.08 + opacity ease.
- 중앙 PHON FAB: 상시 breathing glow + hover 시 골드 코로나 확대.
- Half-Off FAB(있다면): warm-gold pulse 강화.

## 5. 디자인 토큰 추가 (`src/index.css`)

새 클래스만 추가, 기존 토큰 변경 없음:

- `.imperial-card` — luxury hover lift + ring + inner glow
- `.imperial-breathe` — 2.4s ease-in-out glow pulse
- `.imperial-halo` — 골드 radial halo (FAB/CTA용)
- `.imperial-text-glow` — 텍스트 drop-shadow

위 클래스를 Dashboard 카드, Landing CTA, Nav FAB, Trading entry에 부착.

## 변경 파일

- `src/components/Layout.tsx` — 사이드바 평탄화
- `src/components/nav/PhonaraNav.tsx` — bottom nav polish
- `src/pages/Dashboard.tsx` — 카드/칩/Hero polish (className 교체만)
- `src/pages/Landing.tsx` — Hero/CTA polish (className 교체만)
- `src/index.css` — 4개 utility 클래스 추가

## 검증

빌드 후 Dashboard / Bottom Nav / Landing 3종 스크린샷 첨부.
