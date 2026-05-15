# Phase 4 — PWA + 독립 배포 준비

7개 Signature Slot이 모두 완성되고 사운드/Empire 연동이 끝난 상태에서, Phonara.world를 Vercel/Cloudflare에서 즉시 독립 배포 가능한 완전한 PWA로 마무리한다.

## 사전 안내 (중요)

Lovable 에디터 미리보기는 iframe 안에서 동작하기 때문에, 캐싱하는 Service Worker는 미리보기에서 stale 콘텐츠/라우팅 문제를 일으킨다. 따라서 **모든 SW 등록은 production 빌드 + 비-Lovable 호스트에서만** 활성화한다 (preview/iframe에서는 자동으로 비활성). PWA의 오프라인·precache 기능은 실제 배포된 phonara.world 도메인에서만 체감된다.

## 작업 범위

### 1. PWA 완성

- `public/manifest.webmanifest` 정합성 점검 (en/ko/ja/vi 4종 다국어, `start_url=/`, `scope=/`, `display=standalone`, maskable 192/512 아이콘 — 이미 존재하는 자산 재사용).
- `index.html`에 `Accept-Language` 기반 매니페스트 hint 정리 + `theme-color`/`apple-touch-icon` 점검.
- 신규 `public/sw-app.js` (Workbox 사용 안 하고 vanilla SW로 가벼움 유지):
  - precache: `/`, `/offline.html`, `/icon-192.png`, `/icon-512.png`, manifest 4종, `/sounds/common/sfx/*` 핵심 6개 (spin_start, reel_stop, button_click, coin_drop, big_win_trigger, legendary_win).
  - runtime cache:
    - `stale-while-revalidate` — `/sounds/[slotId]/**`, `/assets/**` (해시드 정적자산).
    - `network-first` (3s timeout) — HTML navigations.
    - `cache-first` (30d) — 이미지/폰트.
  - 버전: `CACHE_VERSION = "phonara-v1"` 상수, deploy마다 자동 bump (build script에서 timestamp 주입).
- 기존 `public/sw.js` (push) 유지 — 이름 분리해서 충돌 방지. 단일 SW로 통합: `sw.js` 안에 push + cache 둘 다 처리.
- 신규 `public/offline.html`: 미니멀 한국어 카드 ("인터넷 연결을 확인해주세요" + Retry 버튼 → `location.reload()`), 디자인 토큰 인라인.
- 신규 `src/lib/pwa/registerSW.ts`:
  - iframe / `id-preview--*` / `lovableproject.com` / `lovable.app` (preview) 호스트면 등록 스킵 + 기존 등록 unregister.
  - production 빌드 + 위 가드 통과 시에만 `navigator.serviceWorker.register('/sw.js')`.
  - `App.tsx` mount 시 `requestIdleCallback`으로 호출.

### 2. Code Splitting & Lazy Loading

- 현재 `App.tsx`에서 모든 `/casino/*` 라우트와 `CasinoLobby`는 이미 `React.lazy` + Suspense 적용됨 → 확인만, 변경 없음.
- `vite.config.ts` `manualChunks` 보강:
  - `signature-engine` 청크 — `src/components/slots/SlotSignatureWrapper`, `BaseMaxWinOverlay`, `useAnimatedCanvas` 등 7개 슬롯이 공유하는 코어 묶음.
  - `slot-{themeKey}` 청크 — 각 슬롯 페이지 + 전용 Canvas + Overlay만 묶어 슬롯당 < 150KB 목표.
  - `howler` + `src/lib/sounds/**` → `audio` 청크.
- `src/components/celebration/*MaxWinOverlay.tsx` 전부 `lazy()`로 `BaseMaxWinOverlay` 안에서 dynamic import (legendary 도달 시점까지 로드 미루기).

### 3. Performance & Lighthouse

- `npm run build` 후 `dist/` 산출물에 대해 size 보고 (Top 15 chunks, gzip/brotli 양쪽).
- `vite-bundle-visualizer` (devDependency) 1회 실행 → `reports/bundle-2026-05-15.html` 산출.
- `index.html`: LCP 후보 hero 이미지 `<link rel="preload" as="image" fetchpriority="high">` 점검.
- reduced-motion / GPU 레이어는 Phase 2에서 이미 적용 — 회귀 체크만.

### 4. 배포 설정

- 신규 `vercel.json`:
  - SPA rewrites (`/((?!api|assets|sounds|.*\\..*).*) → /index.html`).
  - headers:
    - `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`.
    - `/sounds/*` → `Cache-Control: public, max-age=2592000`.
    - `/sw.js`, `/manifest*.webmanifest` → `Cache-Control: no-cache`.
    - 전역 보안: `X-Frame-Options: SAMEORIGIN` (iframe preview는 허용 도메인 추가), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- 신규 `.env.example`:
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_PUBLISHABLE_KEY=
  VITE_SUPABASE_PROJECT_ID=
  ```
  (Lovable Cloud는 자동 주입, 외부 호스팅 시 수동 설정 필요 안내.)
- Cloudflare Pages용 `public/_headers` + `public/_redirects` 미러 (Vercel 미사용 시 fallback).

### 5. 최종 문서

- 신규 `docs/deployment-checklist.md`:
  - Pre-flight: env vars, Supabase migrations 적용, Sim regression PASS, Sound assets 업로드.
  - PWA: manifest 4종, icons, SW 등록 가드, offline.html 확인.
  - SEO: sitemap.xml, robots.txt, OG 이미지, lang 태그.
  - Security: RLS baseline drift 체크, AAL2 admin 게이트, kill-switch 콘솔 동작 확인.
  - Monitoring: anomaly_events realtime, error_logs, kernel observability 패널.
  - Rollback Plan: Vercel "Promote previous deployment", DB는 down migration 명시 + kill-switch로 trading/withdrawal 즉시 중단 절차.
  - Launch day runbook (T-24h, T-1h, T+0, T+1h).

## 변경 파일 요약

**신규**
- `public/sw.js` (기존 push SW에 cache 로직 통합 — 사실상 rewrite)
- `public/offline.html`
- `src/lib/pwa/registerSW.ts`
- `vercel.json`
- `.env.example`
- `public/_headers`, `public/_redirects`
- `docs/deployment-checklist.md`

**수정**
- `src/App.tsx` — `registerSW()` 1회 호출
- `vite.config.ts` — manualChunks 보강 (signature-engine, slot-*, audio)
- `src/components/celebration/BaseMaxWinOverlay.tsx` — overlay 컴포넌트 lazy 로딩
- `index.html` — preload/theme-color 점검
- `package.json` — `vite-bundle-visualizer` devDep + `analyze` 스크립트

## 보고 형식

작업 후 다음을 보고:
1. Lighthouse 점수 (Mobile / Desktop) — production preview 기준 추정치
2. Precache 포함 assets 목록
3. Lazy loading 적용 후 bundle size 요약 (Top 10 chunks)
4. 배포 직전 남은 작업
5. Ready-to-Deploy 상태 요약
