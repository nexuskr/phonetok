# /guide?tab=starter 영화급 프리미엄 재작성 플랜

현재 7씬은 동작하지만 비주얼 임팩트가 약함. Gold & Dark Empire 테마를 200% 극대화하고 framer-motion 고급 모션·실시간 카운터·SVG 군대 데모·시니어 친화 타이포(22px+/56px+)를 모든 씬에 적용해 “지구 종말급” 몰입감을 만든다.

## 작업 범위

수정 4개 파일, 신규 1개 파일, **`/guide?tab=detail` 및 다른 페이지는 1픽셀도 변경하지 않음**.

### 수정
- `src/components/guide/FomoScrollHero.tsx` — 씬1 HERO 재작성
- `src/components/guide/FomoScrollScenes.tsx` — 씬2~6 재작성 (SVG army 포함)
- `src/components/guide/FomoFinalCTA.tsx` — 씬7 CTA 재작성
- `src/pages/Guide.tsx` — starter 모드일 때 sticky `ThreeSecondHero` 숨김 + scroll-snap 컨테이너에 `senior-mode` 클래스 토글 + 상단 우측 진행 도트 gold neon 강화 (detail 모드 영향 없음)

### 신규
- `src/components/guide/EmpireFX.tsx` — 재사용 FX 프리미티브 (Gold Nebula 배경, Particle Field, AnimatedCounter, GoldDivider, SimBadge). 씬 코드를 짧고 일관되게 유지.

## 씬별 디테일

### 공통 (EmpireFX)
- **GoldNebulaBg**: `bg-gradient-radial` 다층 (gold/15 → primary/10 → background) + 두 개의 `motion.div` blur orb (gold + imperial purple) 천천히 회전·스케일
- **ParticleField**: 12~16개 작은 gold dot이 위로 떠오르는 looping motion (reduce-motion 시 비활성)
- **AnimatedCounter**: `useMotionValue` + `animate()` 로 숫자가 빠르게 카운트 업, `tabular-nums`
- **SimBadge**: 기존 SIM 칩 통일 (`border-border/60` + tracking-widest)
- **시니어 모드**: `data-large="1"` 시 본문 text-[22px] / 버튼 min-h-[64px] / 제목 text-5xl 자동 적용 (utility 함수)

### 씬1 HERO
- 풀스크린 dark nebula + ParticleField + 거대한 gold orb 좌우 양쪽
- 상단 칩: 🔥 `LIVE · 지금 이 순간` (gold pulse ring)
- **초대형 골드 타이틀**: `font-imperial text-5xl sm:text-6xl text-gradient-gold drop-shadow-[0_0_24px_hsl(var(--gold)/0.5)]`
- AnimatedCounter `18,432명` (실시간 +1~3씩 증가) + 작은 라벨 "지금 입금 중 · SIM"
- 보조 라이브 카운터: "오늘 누적 출금 ₩8.2B" (PayoutTicker 스타일, gold neon)
- **Magic Link 최우선 CTA**: gradient-gold 64px+ 버튼 `💎 1분 안에 시작하기 →` (로그인 상태에 따라 라우팅 유지)
- 보조 링크: `이미 회원? 로그인 →` (작게)
- 하단 SCROLL ↓ bounce 모션

### 씬2 PROBLEM (한국인 공감 폭발)
- 배경: dark + destructive nebula (붉은 글로우)
- 큰 제목 22px+: "주식·전세사기·다단계로 평생 모은 돈을 잃습니다"
- 3개 통계 카드: **숫자 카운터 애니메이션** (`-42%`, `1.2조원`, `98%`) + 카드 좌→우 stagger slide-in
- 하단 큰 글씨 cue: "이제 그만 잃으세요 ↓"

### 씬3 SOLUTION (60초 군대 배틀 SVG 데모)
- 배경: primary/secondary gradient + subtle grid
- 제목: "버튼 2개로 끝나는 군대 배틀"
- **SVG Army Animation**: 좌우로 마주보는 두 군대 (각각 5명 simple soldier silhouettes), 가운데 ↑/↓ 결과 표시. `whileInView` 로 진입 시 양쪽이 충돌하듯 다가오고 위 방향 화살표가 폭발하며 좌측 군대 승리 → 골드 빛 폭발 (3초 loop)
- 큰 ↑ / ↓ 두 버튼 (시니어 56px+) — disabled 데모 (`pointer-events-none`)
- 하단: "60초 후 결과 · 출퇴근 1판 · 룰 끝"

### 씬4 PROOF (운영자 무손실 황금 인장)
- 배경: emerald/gold 미묘한 글로우
- 중앙 **거대한 원형 골드 인장 SVG**: "운영자 무손실 / GUARANTEED" + 회전 ring + gold neon glow (CSS animate-spin slow + drop-shadow)
- 그 아래 LivePayoutSlaBadge + PayoutTicker
- 캡션 22px: "평균 출금 23분 · OTP 필수 · 사업자 정식 등록"

### 씬5 PERSONA
- 3개 아바타 카드 (20·40·60대) — 큰 원형 emoji 아바타 + gold ring + 카드 hover/whileInView 시 좌→우 sweep gloss
- 각 카드: "당신과 같은 [20대 직장인] [홍길○] 님이 어제 +85만원 입금"
- "당신과 같은 사람이 제국을 쌓고 있습니다" 큰 타이틀

### 씬6 PACKAGE (EmpireMonarch + Recovery 폭발)
- 배경: gold-heavy gradient + nebula
- **거대한 EmpireMonarch 카드**: 골드 테두리 더블 + 코너 crown SVG + `text-gradient-gold` 가격
- 4개 특전 (손실 자동 보상 / 보상 4배 / 우선 출금 / VIP 룰렛) — 진입 시 stagger + Recovery 라인은 **빨강→골드 폭발 파티클**
- 하단 mini CTA: "50,000원부터"

### 씬7 FINAL CTA
- 풀스크린 gold nebula + ParticleField 밀도 2배
- 거대 타이틀: "지금, 제국에 입성하십시오"
- **초대형 💎 50,000원 1탭 입금 버튼**: gradient-gold, min-h-[88px], text-2xl font-black, neon pulse glow ring (motion 반복)
- 보조: "패키지 전체 보기" + 법적 disclaimer
- DepositCTA 유지 (로그인 분기 + AdultGate 보장)

## 기술 디테일

- 모든 색은 `index.css` 토큰만 사용 (`--gold`, `--primary`, `--secondary`, `--destructive`, `--background`, gradient utilities). 하드코딩 hex 없음.
- `useReducedMotion()` 가드: prefers-reduced-motion 시 looping/particle 비활성, 초기 entry만 fade.
- IntersectionObserver는 framer-motion `whileInView` 로 대체 (이미 사용 중).
- `Guide.tsx`는 starter 모드일 때만 sticky `ThreeSecondHero` 제거 (전체 화면 몰입). detail 모드는 그대로.
- scroll-snap-mandatory 유지, snap-stop-always 추가로 영화 같은 진행.
- 시니어 모드: 기존 `largeText` 토글을 starter 씬 컴포넌트로 prop 전달 → 본문/버튼 강제 22px/56px+.

## 절대 불변
- Gold & Dark Empire 1픽셀 (모든 색=토큰)
- Magic Link 최우선 CTA, AdultGate 우회 없음, 출금/AAL2/OTP/RPC 0변경
- `/guide?tab=detail`, 다른 모든 페이지, 게임 엔진, store, supabase 함수 미수정
- `src/integrations/supabase/*` 미수정

## 검증 체크리스트
- `/guide?tab=starter` → 7씬 풀스크롤, scroll-snap, 영화급 몰입
- HERO 카운터 18,432 → 실시간 +1~3 증가, SIM 배지 노출
- SOLUTION SVG army 데모 진입 시 충돌 애니메이션 재생
- PROOF 골드 인장 회전 + glow
- CTA 50,000원 버튼 88px+ 골드 neon pulse, 클릭 시 `/wallet?intent=first-deposit&amount=50000` (로그아웃 시 `/secure-auth?next=...`)
- prefers-reduced-motion 활성 시 looping 모두 정지
- 시니어 토글 → 본문 22px, 버튼 56px+, 가독성 OK
- `/guide?tab=detail` 완전 동일 (회귀 0)
- 빌드 오류 0, 디자인 토큰 외 하드코딩 색상 0
