
# /secure-auth Empire Cinematic V2 재작성 플랜

Guide V2와 동일한 프리미엄·시네마틱 수준으로 로그인 페이지를 완전히 새로 만든다. 기능(매직링크/Google/Apple/이메일+비밀번호/회원가입)은 100% 유지하고, 시각·모션·정보 위계만 업그레이드한다.

## 1. 최종 구조 (위에서 아래로)

```text
┌─────────────────────────────────────────┐
│ AdultOnlyBanner (상단 고정)              │
│ LanguageSwitcher (top-right)             │
├─────────────────────────────────────────┤
│ [배경 레이어]                            │
│  GoldNebulaBg(tone=gold)                 │
│  ParallaxLayer → GoldOrbitField(12)      │
│  ParticleField(10)                       │
│  GoldVignette (포함)                     │
├─────────────────────────────────────────┤
│ ImperialSeal 168px                       │
│  label="ENTRY" / title="제국\n입장"      │
│  caption="PHONARA EMPIRE · EST. 2026"    │
│                                          │
│ HERO 타이틀 (gold stroke + glow + drop)  │
│  "제국 입장을 위한 마지막 관문"           │
│  "폰 하나로 제국을 쌓는다"                │
│                                          │
│ 라이브 SIM 스트립 (3 카드)               │
│  지금 입장 중 · 오늘 가입 · 평균 입장 22초 │
│  (AnimatedCounter + SimBadge)            │
├─────────────────────────────────────────┤
│ [메인 CTA 카드 — neon-border + glow-xl]  │
│  ① 이메일 입력 (h-14, text-lg)           │
│  ② 🪄 Magic Link 메가 버튼               │
│     - min-h 72px, text-2xl, gold gradient│
│     - 2.4s sheen wave, glow-gold-xl      │
│  ③ helper: 5분 유효 · 비밀번호 불필요     │
│  ─────── GoldDivider ───────             │
│  ▼ 고급 옵션 (Google/Apple/비번/회원가입) │
│     접힘 기본, motion height auto         │
├─────────────────────────────────────────┤
│ Trust footer pills (가로 4)              │
│  19+ AdultGate · Magic Link 5분 ·        │
│  AAL2 · 운영자 무손실                    │
└─────────────────────────────────────────┘
```

## 2. 비주얼 / 모션 사양

- **배경**: `GoldNebulaBg tone="gold"` → 그 위에 `ParallaxLayer strength={40}` 안에 `GoldOrbitField count={12}`, 추가로 `ParticleField density={10}`. `scroll-snap` 미사용(단일 뷰포트). `prefers-reduced-motion`이면 EmpireFX 내부 가드로 자동 정적.
- **인장**: 기존 `ImperialSeal` 재사용. 라벨 `ENTRY`, 타이틀 `제국\n입장`, 캡션 `PHONARA EMPIRE · EST. 2026`. 모바일에서 size=132, sm 이상 168.
- **타이틀**: `font-imperial` + `text-gradient-gold` + `WebkitTextStroke: 1px hsl(var(--gold-stroke))` + drop-shadow `glow-gold-xl`. 22px(모바일) → 56px(데스크).
- **서브카피**: 24px (`senior.bodyXl` 토큰), break-keep, `text-foreground/85`.
- **SIM 스트립**: 3 카드 횡배치(모바일 1열 가로 스크롤 없이 grid-cols-3 작게), 각 카드 `AnimatedCounter jitter` + `SimBadge`. 카운터는 클라이언트 측 fake (백엔드 미변경): 연결 1,247 / 오늘 가입 384 / 평균 22초.
- **메가 CTA**: `min-h-[72px]` (시니어 모드 시 `senior.btnXl`로 자동), `text-2xl`, `bg-gradient-imperial` + `glow-gold-xl`, 내부 `motion.div` sheen: `x: ["-120%","220%"]` 2.4s linear infinite, 마스크 `linear-gradient(90deg,transparent,white,transparent)`.
- **고급 옵션 토글**: `motion.div animate height` + `▼/▲` 회전. 안에 Google·Apple 2-col, 그 아래 비밀번호/회원가입 폼(기존 코드 그대로 이식, Field 컴포넌트 재사용).
- **트랜지션**: 카드 진입 `whileInView fade+y`, stagger. 페이지 진입 시 ImperialSeal `scale 0.9→1`, 타이틀 `y 24→0`.
- **시니어 토큰**: 루트 div에 `data-large={isLargeMode}` 부여. `isLargeMode`는 localStorage `pm_large` 또는 기본 `true`(20~70대 친화 요구) — 기존 senior 토큰 적용.

## 3. 정보 위계 (요구 사항 그대로)

1. ImperialSeal + Hero
2. 이메일 + **Magic Link 메가 버튼** (최우선)
3. 고급 옵션(접힘): Google / Apple / 이메일+비번 로그인 / 회원가입(닉/실명/전화/생년월일/약관 2개)
4. Trust 푸터

기존 모든 핸들러(`sendMagicLink`, `social`, `submit`, signup zod 스키마, referral code apply, age 19 체크) **100% 보존**. 다국어 키도 동일.

## 4. 파일 변경

- **edit**: `src/pages/SecureAuth.tsx` — 전체 JSX/스타일만 V2로 교체. 비즈니스 로직(이벤트 핸들러, zod, redirect 로직)은 동일 함수 그대로 둠.
- **재사용 (수정 없음)**: `EmpireFX.tsx`의 `GoldNebulaBg`, `GoldOrbitField`, `ParallaxLayer`, `ParticleField`, `ImperialSeal`, `AnimatedCounter`, `SimBadge`, `GoldDivider`, `senior` 토큰.
- **재사용**: `AdultOnlyBanner`, `LanguageSwitcher`, `CinematicIntro`(타이틀 위 한 줄 인트로로 유지).
- **신규 컴포넌트 없음**, **신규 토큰 없음**, **백엔드/마이그레이션 없음**, **types.ts 미수정**.

## 5. 접근성 / 시니어

- 본문 24px, 메가 버튼 72px, 보조 버튼 56px.
- 포커스 링 명확(`focus-visible:ring-2 ring-gold/70`).
- `aria-expanded`, `aria-controls`로 고급 옵션 토글 명시.
- `prefers-reduced-motion` 시 EmpireFX 가드 + sheen 자동 정적.
- 컬러 토큰만 사용, 하드코드 색 없음.

## 6. 검증

- 빌드 통과 (typecheck 자동).
- `/secure-auth` 진입 시: 인장→타이틀→메가 CTA 자연스러운 스크롤(단일 뷰포트 fit), 951×1250 viewport에서 클리핑 없음.
- 매직링크 발송, Google/Apple, 이메일 로그인/회원가입, referral code apply, 1세션 자동 `/dashboard` 리다이렉트 — 기능 회귀 없음.
- reduced-motion ON 상태 시 모든 무한 애니메이션 정지 확인.

승인 시 단일 파일 교체로 즉시 적용한다.
