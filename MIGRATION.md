# ApexForge — Production Migration Guide

ApexForge ships today as a **hybrid overlay** on the existing Phonara stack (React 18 + Vite + Supabase). This guide describes how to migrate the new `/apex/*` surfaces and mock layers (NFT lootbox, sportsbook, provably-fair RNG) to a production-grade Web3 platform without breaking any existing Phonara money flow.

> Current state: 7 ApexForge tabs (`/apex`, `/apex/free`, `/apex/vault`, `/apex/reels`, `/apex/lootbox`, `/apex/sports`, `/apex/my`) overlay the Phonara experience. All rewards settle in-game as PHON via existing `phon_balances` / `request_withdrawal` flow. Money-flow 8-path git diff = 0.

---

## 1. Target Architecture

| Layer | Today | Target |
|------|------|------|
| Web shell | Vite + React 18 | **Next.js 15 App Router** (RSC + edge runtime) |
| Monorepo | single repo | **Nx** workspace (`apps/web`, `apps/api`, `apps/worker`, `libs/*`) |
| API | Supabase RPC | **NestJS 10** (REST + WebSocket Gateway) |
| DB ORM | postgres-js | **Prisma 5** with service-role bypass |
| Queues | pg cron | **BullMQ + Redis 7** (settlements, lootbox roll, reel ingest) |
| Realtime | Supabase Realtime | **NestJS WS Gateway** + Cloudflare Durable Objects |
| Casino RNG | server RPC | **Rust gRPC (Tonic)** provably-fair with Ed25519 commit/reveal |
| NFT | mock rows | **Solana cNFT (Bubblegum V2)** via Metaplex Umi + Helius DAS |
| Asset storage | none | **Arweave / Bundlr** for cNFT metadata + reel thumbnails |
| Rendering | none | **Remotion 4** → R2 → CDN for vertical big-win MP4s |
| Observability | Supabase logs | **OpenTelemetry → Tempo + Loki + Grafana** |
| CDN/Edge | Lovable | **Cloudflare Pages + Workers + R2** |

---

## 2. Step-by-Step Migration

### Phase 0 — Repo lift

1. `npx create-nx-workspace@latest apexforge --preset=next`
2. Generate apps: `apps/web` (Next 15), `apps/api` (Nest 10), `apps/worker` (Nest standalone).
3. Generate libs: `libs/ui`, `libs/contracts`, `libs/db-prisma`, `libs/solana`.
4. Copy `src/packages/apex/*` → `libs/ui/src/apex/`. Tailwind tokens (`apex-neon`, `apex-magenta`) move into `libs/ui/tailwind-preset.ts`.
5. Copy `src/pages/apex/*` → `apps/web/app/apex/*/page.tsx`. Convert to RSC where possible; client islands keep `"use client"`.

### Phase 1 — Data layer

1. `pnpm add -w prisma @prisma/client` → `prisma db pull` from existing Supabase URL.
2. Add Prisma models for tables shipped today: `free_missions`, `free_mission_claims`, `daily_vault_state`, `daily_vault_claims`, `mock_lootbox_opens`, `sports_mock_events`.
3. Add **new** production tables:
   - `cnft_assets(id, mint, owner, tier, metadata_uri, minted_at)`
   - `provably_fair_rolls(id, server_seed_hash, client_seed, nonce, result, revealed_at)`
   - `sports_real_events` (fed by Sportradar / Bet365) + `sports_real_bets` with FK to `phon_balances`.
4. Keep existing `claim_free_mission`, `claim_daily_vault`, `open_mock_lootbox` RPCs alive during cutover; new Nest endpoints write to the same tables for compatibility.

### Phase 2 — Casino RNG (Rust gRPC)

```bash
cargo new --bin services/rng
# Cargo.toml deps: tonic, prost, ed25519-dalek, rand_chacha
```

- Implement `Roll(server_seed_hash, client_seed, nonce) -> RollResult` using HMAC-SHA256 commit/reveal.
- Nest gateway: `apps/api/src/casino/casino.controller.ts` proxies HTTP → gRPC.
- Publish proofs to `provably_fair_rolls` and expose verifier at `/apex/fairness/:rollId`.
- Stake.com offers SHA-256-only — ApexForge ships Ed25519-signed proofs for stronger guarantees.

### Phase 3 — Solana cNFT lootbox

1. `pnpm add @metaplex-foundation/umi @metaplex-foundation/mpl-bubblegum @metaplex-foundation/umi-bundle-defaults`
2. Create one Merkle tree per tier (Basic/Premium/Ultimate) via `createTree`.
3. Replace `open_mock_lootbox` with BullMQ job → `mintToCollectionV1` (Bubblegum V2) → write `cnft_assets` row.
4. Index ownership using **Helius DAS API** (`getAssetsByOwner`), cache 15s in Redis.
5. Upload metadata + image to Arweave via `@bundlr-network/client` before mint.
6. UI: `/apex/lootbox` reveal modal links to `https://solscan.io/token/<mint>`.

### Phase 4 — Sportsbook (real)

1. Sportradar OAuth → ingest worker writes `sports_real_events` every 30s.
2. Nest endpoint `POST /sports/bet` debits `phon_balances` via existing money-flow guard pattern.
3. Settle via BullMQ delayed jobs at `event.ends_at + 5min`.
4. Compliance: geofence non-Korean residents at edge using Cloudflare `CF-IPCountry` header.

### Phase 5 — Win Reels (TikTok-style)

1. Ingest worker subscribes to existing big-win Postgres `LISTEN/NOTIFY` (casino + duel settle).
2. Filter `payout_phon / bet_phon >= 50` → enqueue render job.
3. **Remotion 4** renders 1080×1920 MP4 → R2 → CDN. Thumbnail to Arweave.
4. Replace mock array in `/apex/reels` with infinite-query against `GET /reels?cursor=...`.

### Phase 6 — Observability + SRE

1. `@opentelemetry/sdk-node` in Nest, exporter → Tempo on EKS / Fly.io.
2. Grafana dashboards for: RPC p99, RNG drift (≤5bps), cNFT mint failure %, lootbox cost vs reward EV.
3. Alertmanager → PagerDuty.

### Phase 7 — PWA / Mobile

1. `next-pwa` with workbox; precache `/apex/*` shell, runtime-cache reels MP4 with `stale-while-revalidate`.
2. Reuse existing manifests (ko/en/ja/vi).
3. Add **App Shortcuts** for `/apex/free`, `/apex/vault`, `/apex/reels`.

---

## 3. Cutover Plan

| Step | Risk | Mitigation |
|------|------|-----------|
| Dual-write `claim_*` RPC + Nest API | Low | Idempotency key per `(user, mission, date)` |
| Switch `/apex/lootbox` to cNFT | Medium | Feature flag `apex_cnft_live` per user; mock path stays alive |
| Sportsbook go-live | High | Korean compliance review; geofence default-deny |
| Decommission Vite | High | Run Next 15 on `apex.phonara.world` first; 301 from `/apex/*` after 30d |

**Money-flow guarantee:** Phonara's 8 protected paths (`request_withdrawal`, `phon_swap_*`, `phon_betting_*`, `imperial_place_phon_bet`, etc.) are **never touched**. ApexForge writes only to its own tables + the existing `phon_balances` ledger via the documented `grant_phon_for_*` pattern.

---

## 4. Estimated Effort

- Phase 0–1: 2 weeks (1 senior FE + 1 DBA)
- Phase 2: 3 weeks (1 Rust eng)
- Phase 3: 3 weeks (1 Solana eng)
- Phase 4: 4 weeks (1 BE + compliance)
- Phase 5: 2 weeks (1 video eng)
- Phase 6–7: 2 weeks (SRE)

**Total: ~16 engineering-weeks** for full destruction of Stake.com + Rollbit + Freecash.com parity.

---

## 5. Why ApexForge Crushes The Competition

| Capability | Stake.com | Rollbit | Freecash | **ApexForge** |
|---|---|---|---|---|
| Casino games | ✅ | ✅ | ❌ | ✅ (existing Phonara) |
| Daily free PHON missions | ❌ | ❌ | ✅ | ✅ |
| Daily golden vault w/ pity | ❌ | ❌ | ❌ | ✅ |
| TikTok-style win reels | ❌ | partial | ❌ | ✅ |
| cNFT lootbox (Solana) | ❌ | ✅ NFT marketplace | ❌ | ✅ (Bubblegum V2) |
| Sportsbook | ✅ | ❌ | ❌ | ✅ |
| Provably-fair Ed25519 | ❌ SHA-256 only | ❌ | ❌ | ✅ |
| Korean direct KRW payout | ❌ | ❌ | ❌ | ✅ (Phonara) |
| Korean side-hustle viral loop | ❌ | ❌ | partial | ✅ |

Single platform. Zero competitor checks every box.
