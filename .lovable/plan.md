# Phase E — Slice 2: 핵심 화면 4종 Imperial Polish

목표: Auth · Dashboard · /trade · /phon 네 화면을 Stake.com급 시각 위계 + Warm King 톤으로 끌어올리되, 페이지 구조·라우팅·비즈니스 로직은 1줄도 건드리지 않는다. money-flow 8경로 / Operator Isolation / Bundle Budget 전부 무손상.

## 범위 (이번 슬라이스에서 하는 것)

1. **공통 타이포 / 스페이싱 토큰 정렬 (`src/index.css`)**
   - `--rhythm-1..6` (4·8·12·16·20·24) CSS 변수 추가, `.section-rhythm`, `.stack-rhythm-*` 유틸 클래스.
   - `.h-display`, `.h-imperial`, `.eyebrow-imperial` 타이포 유틸 (LCP 텍스트 letter-spacing / leading 통일).
   - 기존 토큰 덮어쓰지 않음 — 추가만.

2. **Slice 1 프리미티브 확장 — Imperial Half-Off Gradient**
   - `src/components/ui/floating-fab.tsx` 에 `gold-pink` 변형 추가 (Gold → Hot Pink half-off gradient + strong glow ring + 옵셔널 pulse halo). 기본 `gold` 동작 그대로 유지.
   - `src/components/nav/PhonaraNav.tsx` active 탭에 Half-Off 글로우 한 단계 강화 (현재 amber 단색 → amber↔pink 절반 분할 후광). 비활성 외형 동일.

3. **Auth 화면 (`src/pages/Auth.tsx`) 비주얼 폴리시 only**
   - 헤더 hierarchy: eyebrow `황제 입장` / display `폐하의 자리가 비어 있습니다` / 서브 카피.
   - 입력 카드 24px radius + 백드롭 블러 + warm gold inner ring.
   - 버튼 톤을 `gold-pink` half-off 그라디언트로 통일, min-h 48.
   - 폼 로직 / 라우팅 / Supabase 호출 0줄 변경.

4. **Dashboard 헤더 영역 (`src/pages/Dashboard.tsx`) only**
   - 상단 히어로 블록 spacing rhythm 적용 (mb-3/5, gap-3, p-5).
   - 인사 타이포 hierarchy (eyebrow + display + warm gold 그라디언트).
   - 기존 위젯 마운트 순서 / 컴포넌트 props 0줄 변경.

5. **/trade 화면 헤더 (`src/pages/TradingArenaWithArmy.tsx` 헤더 영역)**
   - 페이지 상단 타이틀 + 서브카피 + 거래소 페어 칩 영역만 hierarchy 정리.
   - 차트 / 주문 패널 / 포지션 컴포넌트 손대지 않음.

6. **/phon 화면 (`src/pages/PhonHub.tsx` 상단 H1 영역)**
   - eyebrow `폐하의 황금 자산` / display `PHON` / FOMO 1줄 서브카피.
   - 그 아래 `PhonHubDashboard` 등 기존 섹션 그대로.

7. **FOMO 카피 토큰화 (`src/lib/glossary.ts` 에 `FOMO` 네임스페이스 추가)**
   - 5종 Imperial FOMO 문구를 상수로 등록 (`FOMO.lobbyCrowd`, `FOMO.legendaryCrown`, `FOMO.friendProfit(name, amount)`, `FOMO.rareParts`, `FOMO.exclusiveOwn`).
   - LobbyFab / Dashboard 인사 영역 / Auth 서브카피 등에서 토큰만 호출.

## 비범위 (이번 슬라이스에서 안 함)

- 신규 페이지 / 라우트 / RPC / 마이그레이션 / 엣지 함수.
- IA · 네비 구조 · 페이지 컴포넌트 마운트 순서 변경.
- 게임 로비 카드 (Slice 3), Streak / 출금 카운터 (Slice 4).
- three3d 청크, Lobby v3 내부 (Phase D 동결).
- money-flow 8경로 파일 (`PRJ_FREEZE_RAW_CHANNEL`).

## 보호 가드 (모든 변경 통과해야 함)

- money-flow 8경로 git diff = 0줄
- `node scripts/check-operator-isolation.mjs` PASS
- `npm run size:check` PASS — index ≤ 180KB gz, three3d / lobby / wallet / slots 청크 변동 0
- raw `supabase.channel(...)` 0건 추가
- 색상은 HSL 토큰만, 인라인 hex 금지 (lobby v3 three.js 입력은 예외 유지)
- ESLint: no-direct-sonner / no-raw-channel 유지

## 검증 절차

1. `git diff --name-only` 로 변경된 파일이 위 7개 항목 범위 내인지 확인
2. money-flow grep diff `scripts/check-money-flow-freeze.mjs` 또는 수동 grep 0줄
3. `node scripts/check-operator-isolation.mjs`
4. `npm run size:check`
5. 프리뷰에서 Auth → Dashboard → /trade → /phon 순회, FAB / Bottom Nav active glow / FOMO 카피 노출 확인
6. `mem://features/phase-e-slice-2-core-screens` 신규 등재 + `mem://index.md` 갱신

## 기술 메모

- Half-Off Imperial Gradient = `linear-gradient(100deg, hsl(38 92% 55%) 0% 50%, hsl(330 85% 60%) 50% 100%)` + `box-shadow: 0 12px 32px -10px hsl(38 92% 55% / 0.55), 0 0 0 1px hsl(330 85% 60% / 0.35) inset`.
- Pulse halo = 1.4s ease-in-out infinite, opacity 0.0↔0.55, `will-change: opacity, transform`.
- CSS Containment: 카드 컨테이너에 `contain: layout paint` 적용 (Auth 입력 카드 / Dashboard hero / Phon hero).
- 모든 인터랙티브 표면에 `press` 클래스 + `will-change-transform` 유지.
- `prefers-reduced-motion`: pulse / halo 자동 OFF.

Slice 3, Slice 4 는 별도 턴에서 진행. 이번 슬라이스에서 위 7항목 외 코드는 절대 수정하지 않음.
