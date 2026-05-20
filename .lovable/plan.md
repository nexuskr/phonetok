# Phase 4 — Slice 1: Landing Apocalypse + VRF v2.5 (Drand Hybrid)

이번 턴은 P4-A 와 P4-D(VRF) 두 슬라이스를 묶어서 압살한다. P4-B/C/E 는 후속 턴.
머니플로 8경로 git diff = 0, House Edge §6 0 터치, Layer 1 gz ≤ 180KB, chunk ≤ 80KB 가드레일 유지.

---

## P4-A Landing Apocalypse (`/` viral, `/safe` SEO)

### 라우트 분리
- `/` (기존 Index.tsx 유지) — 그 위에 **lazy `<ApexLandingApocalypse/>`** 를 selective 마운트하지 않고, 신규 라우트 `/apex` 의 ApexShell index 를 새 `<LandingApocalypse/>` 로 교체 + `/landing` 명시 라우트 추가. 기존 홈 미터치.
- `/safe` — 신규 페이지 `src/pages/SafePublic.tsx` (Meta-safe, 검색엔진/OG 친화, JS 최소)

> 이유: `/` 는 이미 풍부한 콘텐츠가 있으므로 건드리지 않고, Apex 도메인 (`/apex`) 내부 첫 화면을 Landing Apocalypse 로 강화한다. SEO 압살은 `/safe`.

### `@pkg/apex/landing/` 구성 (전부 lazy, gz ≤ 60KB 1청크)
- `LandingApocalypse.tsx` — Hero(FOMO 카피 + 카운트다운) / `<LandingBigWinTicker/>` / `<LandingRaceCountdown/>` / `<TierSTeaserGrid/>` / `<TrustStrip/>` / CTA
- `LandingBigWinTicker.tsx` — `get_whale_strikes_24h(_limit:=12)` 60s 폴, framer-motion marquee
- `LandingRaceCountdown.tsx` — `apex_get_current_races()` 첫 race ends_at → ticking
- `TierSTeaserGrid.tsx` — 5종 카드(`/apex/games/{pump,wheel,limbo,keno,hilo}`)
- 모든 컬러 토큰만, notify 4-tier, useGameChannel/useWalletChannel only

### LCP < 1.2s 전략
- Hero 텍스트 + CSS gradient 만 첫 페인트(이미지 0)
- BigWin / Race / TierS 모두 `<Suspense>` + `loading-state` 폴백
- modulePreload 필터에 `apex-landing` 추가 (entry 차단)

### `/safe` SEO 페이지
- `src/pages/SafePublic.tsx` + `react-helmet-async` 동적 임포트 (이미 의존성 있으면 재사용, 없으면 추가)
- 단일 H1 + 6개 섹션(What/Why/Tier S/Trust/Stats public/FAQ) + JSON-LD `WebSite` + `FAQPage`
- `index.html` 의 sitewide head 는 유지, `/safe` 만 Helmet override (canonical `https://phonara.world/safe`)
- `scripts/generate-sitemap.ts` 가 없으면 신규 작성 + `predev`/`prebuild` 등록, 있으면 entries 에 `/safe`, `/apex`, `/apex/games/{...}` 추가 후 재생성

---

## P4-D VRF v2.5 — Drand + Ed25519 + 기존 RNG 하이브리드 (read-only 트레이스 레이어)

> **머니플로 0 터치 원칙**: 기존 `apex_play_mock_game` / Crash V2 정산 코드는 **건드리지 않는다**. VRF v2.5 는 별도 “provenance attestation” 레이어로, 정산 직후 비동기 트레이스만 기록한다.

### DB (마이그레이션 1건)
```
apex_randomness_requests (
  id uuid pk default gen_random_uuid(),
  game text not null,              -- 'crash_v2' | 'pump' | 'wheel' | 'limbo' | 'keno' | 'hilo'
  round_ref text not null,         -- crash round_id / play idempotency_key
  drand_round bigint,              -- League of Entropy round
  drand_randomness text,           -- hex
  server_signature text,           -- Ed25519 over (game|round_ref|drand_round|drand_randomness|client_seed)
  server_pubkey text,              -- base64
  client_seed text,                -- optional, from client at bet time
  composed_seed text,              -- sha256(drand_randomness || server_signature || client_seed)
  created_at timestamptz default now(),
  unique(game, round_ref)
);
```
- RLS: `SELECT` public (검증 페이지가 비로그인도 봐야 함), `INSERT` SECURITY DEFINER RPC 만
- RPC `apex_record_randomness(game, round_ref, drand_round, drand_randomness, server_signature, server_pubkey, client_seed)` — 본인/edge 만 호출, idempotent

### Edge: `supabase/functions/apex-vrf-oracle`
- 1분 cron: 최근 1시간 내 게임 결과 중 `apex_randomness_requests` 미존재 round 를 backfill
- per-round 동기 호출 모드도 지원: `POST /apex-vrf-oracle` { game, round_ref, client_seed? } → Drand round 가져와 Ed25519 서명 → DB INSERT → JSON 응답
- Drand 소스: `https://api.drand.sh/public/latest` (League of Entropy, 30s round), 실패 시 `https://drand.cloudflare.com` fallback
- Ed25519 키는 `APEX_VRF_ED25519_SK` (서버) / 공개키는 코드 상수로 노출

### 클라이언트 트레이스 (`@pkg/apex/oracle/`)
- `useVrfTrace(game, roundRef)` — `apex_randomness_requests` SELECT, 30s SWR
- `<VrfTraceCard>` — Drand round / randomness / Ed25519 sig / composed seed + “Drand Explorer” 외부 링크 (`https://api.drand.sh/public/{round}`)
- Verify 페이지(`src/pages/apex/Verify.tsx`)에 `<VrfTraceCard>` 추가
- TierS / Crash V2 게임 슬립 컴포넌트에 “🔒 Verified by Drand” 작은 배지 (lazy, gz <1KB)

### cron 등록 (insert tool)
- `apex-vrf-oracle-1m` `* * * * *`

### Secret
- `APEX_VRF_ED25519_SK` — 사용자에게 `secrets--add_secret` 으로 요청 (없을 시 edge 는 503 + DB 미기록)

---

## 검증 & 리포트
- `node scripts/check-money-flow-freeze.mjs` → 8/8 PASS
- `reports/apex-phase4-slice1.2026-05-20.json` 작성 (LCP 추정, /safe meta, VRF latency p95, Drand fallback, bundle size)
- 머니플로 8경로 본문 git diff = 0 (Crash V2 / Tier S 정산 코드 미터치 확인)

---

## 본 슬라이스에서 의도적으로 **하지 않는 것**
- P4-B PWA (Workbox/Install) — 다음 턴
- P4-C Health Dock Run-book — 다음 턴
- P4-E i18n / 통화 5종 / 라이브 채팅 — 다음 턴
- 머니플로 코드 (apex_play_mock_game / apex_crash_settle 등) 본문 변경 — 영원히 금지

---

## 기술 노트
- `index.html` head 의 canonical/og 는 `/` 기준 유지, `/safe` 는 Helmet 으로 override
- `vite.config.ts` modulePreload 필터에 `apex-landing` 패턴 추가
- 신규 코드 전부 `@pkg/apex/*` 또는 `src/pages/apex/*` + edge `apex-*`
- realtime 은 useGameChannel(`game:apex:landing-ticker`) 1개만
