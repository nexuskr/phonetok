# PR-M — Edge Caching + i18n CDN (Phase 4 · Slice 2)

## 목표
정적 자산 immutable 1년, HTML 즉시 재검증, 공개 RPC 60s SWR + stale-while-revalidate 5분.
재방문 LCP -30%, CDN 부하 -70%.

## 절대 보호
- money-flow 8경로 git diff = 0
- 인증/민감 RPC는 캐시 금지 (오직 4개 공개 RPC만)
- PR-K operator isolation / PR-L bundle budget 회귀 0

## 산출물

1. **`public/_headers` 강화**
   - `/assets/*` immutable 1년 (유지)
   - `/` + `/index.html` → `public, max-age=0, must-revalidate`
   - `/locales/*` immutable 1년 추가
   - `/sounds/*` SWR 유지

2. **`src/packages/core/swr.ts`** — 신규 공개 RPC SWR 헬퍼
   - `swrFetch(key, fetcher, { ttl=60_000, swr=300_000 })`
   - localStorage 백킹 + 인메모리 promise dedup
   - `useSwr(key, fetcher, opts)` React 훅 (stale 즉시 반환 + 백그라운드 갱신)
   - 화이트리스트 키만 허용: `world_domination_stats`/`recent_payouts_100`/`whale_strikes_24h`/`payout_ops_stats_24h`

3. **edge function 캐시 헤더**
   - `supabase/functions/public-status/index.ts` 응답에 `cache-control: public, s-maxage=60, stale-while-revalidate=300`

4. **검증**
   - build PASS, bundle-budget PASS, money-flow freeze PASS, operator isolation PASS
   - `curl -I /assets/*.js` immutable, `curl -I /` no-cache
   - `reports/edge-cache.2026-05-19.json` 헤더 스냅샷

## 변경 파일
- 수정: `public/_headers`
- 신규: `src/packages/core/swr.ts`
- 수정: `supabase/functions/public-status/index.ts` (응답 헤더만)
- 신규: `reports/edge-cache.2026-05-19.json`
- 수정: `mem://index.md` + 신규 `mem://features/pr-m-edge-cache`

## 영향
- Bundle: 변경 없음 (swr.ts는 opt-in import)
- money-flow: 0줄
- UX: 재방문 즉시 stale 표시 + BG 갱신
- 운영: CDN hit rate ↑, origin 호출 ↓
