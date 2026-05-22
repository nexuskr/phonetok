# FULL SYSTEM AUDIT — PHONARA (brutal, no sugarcoat)

> Plan mode. No code is being written. This is the audit + the rebuild path.

---

## 0. The single most important finding (P0, system-breaking)

**This app is currently bricked at the entry point.**

`src/App.tsx` is a **20-line placeholder** that only routes `/` and `/test`. Everything else `Navigate("/")`. Meanwhile the repo still contains:

| Asset | Count | Disk |
|---|---|---|
| `src/pages/*.tsx` | **131 pages** | 1.1 MB |
| `src/components/**` | **572 components** | 2.9 MB |
| `src/hooks/**` | **90 hooks** | 240 KB |
| `src/packages/**` | 10 @pkg domains | 709 KB |
| `supabase/functions/**` | **77 edge functions** | 411 KB |
| `supabase/migrations/**` | **317 migrations** | 1.9 MB |
| Total `src` LOC | **147,747** | — |

None of `Dashboard`, `Wallet`, `Casino`, `Auth`, `AuthCallback`, `ImperialDuelArena`, `Empire`, `PhonHub`, `Admin`, … are reachable. The Supabase backend (auth, RLS, RPCs, edge functions, kill switches, Imperial Flywheel, AAL2 gating, oracle consensus) is **fully alive and running** with no UI to talk to it.

You are paying for, and exposing, a fully-armed backend that has no front-end client.

---

## 1. System map (inventory at a glance)

```text
phonara/
├── src/
│   ├── App.tsx                  ← 20 LOC placeholder (bricked)
│   ├── main.tsx                 ← still boots full ErrorBoundary/i18n/observers
│   ├── pages/                   ← 131 .tsx files, ALL orphaned
│   │   ├── Index.tsx (419 LOC) ← marketing landing, unreachable
│   │   ├── Dashboard / Wallet / Casino / Empire / Lounge / …
│   │   ├── admin/  (CockpitV2, treasury/, ops/, imperial/CommandCenter…)
│   │   ├── apex/   (15 files, V14 simplification target)
│   │   ├── casino/ (11 slot games)
│   │   └── games/  (3 imperial games)
│   ├── components/              ← 572 files, mostly orphaned
│   │   ├── admin/ ~80
│   │   ├── dashboard/v3/        ← v3 only ever shipped here
│   │   ├── empire/  WhaleStrikeRail / WhaleStrikeRailV3 (dup)
│   │   ├── onboarding/  V2 + V3 (dup)
│   │   ├── slots/ Olympus / OlympusLegacy* (dup)
│   │   └── ui/ shadcn primitives (KEEP)
│   ├── hooks/   90 files
│   ├── packages/  @pkg/{core,ui,wallet,earn,trade,live,games,duel,apex,
│   │             realtime,risk,runtime,telemetry,entropy,performance,
│   │             native,operator,workers,referral,analytics,avatar-nft}
│   ├── lib/  (notify, glossary, flow/, auth/, displayCurrency, …)
│   ├── locales/  en/ko/ja/vi/zh/es/pt
│   └── integrations/supabase/{client.ts, types.ts}   ← auto-generated, KEEP
├── supabase/
│   ├── config.toml              ← project_id ketlqzfaplppmupaiwft (current)
│   ├── functions/  77 edge functions
│   └── migrations/ 317 SQL files (foundational → V17 → Phase 4 P1 Hyperion)
├── scripts/independence/        ← already prepared for migration to NEW ref
│                                  wyhhdyrvqtoejvusnhva  (Phase 2 runbook)
├── e2e/                         ← Playwright suite (7 active specs)
├── reports/                     ← bundle, entropy, realtime, oracle baselines
└── .github/workflows/           ← bundle-budget, db-permissions, perf-gate,
                                   pr3-isolation, prerender, e2e
```

### Orphan / duplicate / dead

- **Every page** under `src/pages/` is orphan relative to the live App.tsx.
- **Versioned duplicates still on disk:**
  `dashboard/v3/*`, `WhaleStrikeRailV3`, `OnboardingV2` + `OnboardingV3`, `StarterFunnelV3`, `OlympusLegacy*` (slot+overlay), `CockpitV2`, `imperialCircuitV2`, `trustV2`, `apex/coach/CoachV2Panel`, `apex/crash/LiveCrashV2`.
- **Dead infra scaffolds** already removed last turn: `phonara-unicorn/`, disabled e2e a11y spec, `/avatar` redirect, duplicate `/guild`.
- **TS `any` occurrences:** 366. **`console.log` lines:** 32. **TODO/FIXME:** 3.

---

## 2. Architecture (actual, not intended)

### Frontend
- Vite 5 + React 18 + React Router 6 + Tailwind 3 + shadcn/radix.
- State: React Query (server cache) + Zustand (light stores, e.g. `useFirstEmperorBurst`) + ad-hoc `useState`. No Redux.
- Realtime: `@pkg/realtime` 4-partition wrapper (`useWalletChannel|useGameChannel|useChatChannel|useMarketChannel`) over `supabase.channel`. ESLint blocks raw `supabase.channel` calls (3 legitimate locations remain: wrapper itself, `useCrashTick`, `GodModePanel`).
- i18n: i18next, 7 locale chunks, gated boot.
- Telemetry: `@pkg/telemetry` web-vitals + sampling, governor + idle/hidden-tab suspension.
- Performance: `@pkg/performance` device tiering + `low:/mid:/high:` Tailwind variants + Degrade Mode (`degrade:` variant + kill switch).
- Operator isolation: vite `manualChunks` segregates `pages/admin/**` into an `operator` bundle, blocked from user entry preload, enforced by `scripts/check-operator-isolation.mjs`.

### Backend (Lovable Cloud, ref `ketlqzfaplppmupaiwft`)
- 317 migrations forming a single timeline through:
  Permission baseline → V17 personalization → Empire/Crown/Founding Seats → Imperial Duel Phase 3–4 → Flywheel 3.5 → Hardening → Oracle Fortress 3.5 (shadow weighted consensus) → Self-Heal Console → VIP Pass → v3.0 LOCKED Foundation → Phase 4 P1 Hyperion observer.
- Money flow concentrated in 8 RPCs (`imperial_place_phon_bet`, `_apply_house_edge_split` 45/35/15/5, `request_withdrawal`, `credit_crypto_deposit`, `award_crown`, `recompute_empire_level`, `grant_phon_for_deposit`, `grant_nft_for_deposit`) — protected by `check-money-flow-freeze.mjs` (git diff must = 0).
- 77 edge functions. JWT verification mostly **disabled** (`verify_jwt = false`); in-code validation is the contract. Cron-driven flywheel/oracle/reactivation/reengagement.
- AAL2 enforced for admin sensitive tabs + withdrawals (TOTP factor or 10-min OTP).
- Kill switches: `platform_kill_switches`, `imperial_kill_switches` (5), `degrade_mode`, `maintenance_mode`.

### Data flow (text diagram)

```text
Browser (Vite SPA)
  │ JWT in localStorage (supabase-js)
  ▼
@pkg/realtime  ──── postgres_changes ◄── Postgres LISTEN/NOTIFY
  │
  ├── RPC (PostgREST)  ──► SECURITY DEFINER fns ──► RLS-protected tables
  │                          │
  │                          ├── money-flow 8 RPCs (frozen)
  │                          └── trigger chain (flywheel, audits, anomaly)
  │
  └── functions.invoke ──► Edge Function (Deno) ──► service-role client
                                                  └── external (Twilio, LINE,
                                                       VAPID push, Lovable AI)
```

### Auth flow
1. `src/pages/Auth.tsx` delegates to `/secure-auth` (not currently routed).
2. Supabase email/password + Google OAuth (configured at provider level).
3. `useMultiTabAuthSync` broadcasts `SIGNED_IN/OUT/TOKEN_REFRESHED` across tabs.
4. `verifySessionOnce` single-flight session cache.
5. AAL2 step-up via TOTP or 10-min OTP for withdrawals + admin sensitive routes.
6. **Today, only `/auth` and `/secure-auth` rendering matters — but the placeholder App.tsx never mounts them.** Browser hits any URL → `/` → placeholder.

---

## 3 & 4. Component / button audit — **not produceable as requested**

A literal per-component dump for 572 components + every button across 131 pages is ~25,000–40,000 lines of structured report. That exceeds this plan's character budget by ~50×, and 99% of it is moot because **the components are not mounted**. If you still want it after the rebuild decision, it must be produced as a separate streamed artifact (CSV per component) over multiple runs — say the word and I scope that as its own job.

What is verifiable now:
- Every page imports its own dependencies (no shared route registry collapsed them).
- Many pages still call `useState` + `useEffect` + `supabase.from(...)` directly without React Query, so the same row gets fetched 3–5× across components on a typical screen.
- Several pages mount `<Toaster />`, `<Layout />`, or shells redundantly — the SlimShell comment in code says "shells are mounted at App root" but App root is the placeholder, so each page that ran would either double-mount or run shell-less.

---

## 5. API & backend audit

- **77 edge functions, 26 explicitly listed in `supabase/config.toml`.** Functions not listed inherit Lovable defaults; many critical ones (e.g. `imperial-bet-place`, `imperial-bet-settle`, `liquidation-watcher`, `oracle-refresh*`, `reengagement-tick`, `reactivation-cron`) rely on **server-side cron + in-code auth**.
- **`verify_jwt = false`** on every public-facing function. This is intentional per Lovable's signing-keys system but means **every function MUST validate the caller in code**. I have not audited all 77 line-by-line in this pass — **UNKNOWN RISK** for the ones outside the documented set (`auth-email-hook`, `handle-email-*`, `preview-*`, `webhook-dispatcher`, `chaos-probe`, `send-push`, `send-line`, `line-webhook`, `dm-composer`, `verify-submission`, `attribute-click`, `toggle-rrm`, `liquidation-watcher`, `enforce-position-triggers`, `og-card-renderer`, `recovery-fomo-trigger`, `sim-api`, `reactivation-cron`, `earn-share-card`, `reengagement-tick`).
- Race conditions: known-good — `live_positions` BEFORE INSERT trigger `trg_enforce_leverage_gate`, `SELECT FOR UPDATE SKIP LOCKED` in founding seats, `reclaim_stale_intents` lease cron, idempotent `_apply_house_edge_split`.
- 1000-row PostgREST limit: there are at least 4 admin tables (`anomaly_events`, `permission_change_log`, `withdrawal_requests`, `imperial_observability_events`) where UI lists likely silently clip — **P2**.
- Frontend SDK: only `src/integrations/supabase/client.ts` is allowed (good). No second-client drift.

---

## 6. State management — disaster level: moderate, not catastrophic

- React Query is used in newer code (@pkg/wallet hooks, V17 widgets), `useState`+`useEffect` in older.
- Zustand stores leak between unrelated features (`useFirstEmperorBurst` triggered from PhonaraPayPanel realtime fill).
- localStorage keys are scattered: `phonara:onboarding60s:v1`, `phonara:currency_pref:v1`, `pm_practice_mode`, `phonara-lang`, supabase auth, viewport-lock, app-settings. No central registry → renaming any one of them silently strands users.
- Multi-tab auth sync is solid; multi-tab feature flag sync is not.
- "Overwritten state" cases I cannot enumerate without runtime testing — **UNKNOWN RISK** until App.tsx is restored.

---

## 7. Critical bug list (severity-ranked)

| Sev | Location | Cause | Impact | Fix |
|---|---|---|---|---|
| **P0** | `src/App.tsx` | Replaced with 20-LOC placeholder; no real routes | **Entire product unreachable.** Backend live but unused. | Restore real router (or do clean rebuild — see §10) |
| P0 | `src/main.tsx` | Domain guard commented out "for debugging" | Auth callback may land on non-canonical host with no enforcement | Re-enable after rebuild |
| P1 | 366 `: any` in src | Type drift | Hidden runtime errors at boundaries | tsc strictness + `unknown` migration |
| P1 | Duplicate components on disk (V2/V3/Legacy listed in §1) | Not actually rendered today, but will be re-imported on rebuild | Same-bug-fixed-twice + bundle bloat | Delete after rebuild graph confirms only-one mount |
| P1 | 77 edge functions, only 26 declared in config.toml | Function-specific config drift | Some functions may be misconfigured silently | Audit all 77 against config |
| P2 | 4+ admin lists hitting 1000-row PostgREST cap | Implicit limit | Silent data clipping | Server-side pagination |
| P2 | 32 stray `console.log` | Logged in production unless `vite-plugin-remove-console` covers them all | Information leak | Verify plugin scope or strip |
| P2 | localStorage key sprawl | No registry | Migration breakages | Central `@pkg/core/storageKeys.ts` |
| P3 | TODO/FIXME (only 3) | — | — | Cosmetic |
| UNKNOWN | 51 edge functions not in config.toml | Auth/JWT settings drift | Auth bypass possible if any of them is a money path | Per-function audit |
| UNKNOWN | RLS policies on 30+ tables not re-validated this pass | Schema drift since last `db-permissions.test.ts` run | Privilege escalation possible | Run `supabase--linter` + replay test suite |

---

## 8. Dead code / garbage

Confirmed dead today (whether or not the placeholder is replaced):

- Every `V2`/`V3`/`Legacy` file listed in §1.
- `src/pages/Test*` (if any survived in pages list — present in App.tsx as inline `TestPage`).
- `e2e/tests/07-a11y-smoke.spec.disabled.ts` — already deleted.
- `phonara-unicorn/` Phase U scaffolding — already deleted.
- 7 locale files exist; only `en/ko/ja/vi/zh` are loaded in current i18n boot — verify `es/pt` are wired before keeping.

Suspected dead, needs reachability re-check post-rebuild:
- `src/packages/apex/*` (Apex pivot — only some files are referenced from `pages/apex/*`, rest may be orphans).
- `src/packages/duel/*` Halo2RecursivePanel.
- `pages/casino/OlympusLegacy*` if Olympus 5000 is the only shipped slot.

---

## 9. Security & stability risks

| Risk | Status |
|---|---|
| `VITE_SUPABASE_URL`, anon key in client | EXPECTED (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, auto-injected — good |
| `LOVABLE_API_KEY`, `BOT_CRON_SECRET`, `VAPID_*`, `TWILIO_*`, `LINE_*` | Server-only secrets (checklist exists in `scripts/independence/secrets-checklist.txt`) — good |
| Domain canonicalisation | **DISABLED** in `main.tsx` — P0 once UI returns |
| AAL2 admin gate | Strong, but only effective if pages route |
| `verify_jwt = false` on 77 edge functions | Acceptable IF each validates in code — **UNKNOWN for 51 of them** |
| Client-side admin/role checks | None observed — roles go through `user_roles` + `has_role()` SECURITY DEFINER (good) |
| Localized PII (KYC, withdrawal addr) | Stored in DB with RLS owner-scoped — good |
| 1000-row PostgREST cap on `anomaly_events` and `permission_change_log` | Possible audit blindspot |
| Multi-tab signed-out leakage | Handled by `useMultiTabAuthSync` |
| Cron-driven money paths (flywheel, oracle) | Protected by kill switches + AAL2 admin panels |

---

## 10. Rebuild strategy — **the only honest path**

Given:
1. App.tsx is a placeholder. Restoring 131 pages of legacy routing into a working product is more work, more risk, and more bloat than rebuilding the user shell.
2. You explicitly want to move to a **new GitHub account** and a **new Lovable project**.
3. The Supabase ref is also being migrated (`ketlqzfaplppmupaiwft` → `wyhhdyrvqtoejvusnhva`, runbook already in `scripts/independence/`).
4. The valuable, production-grade asset is the **backend** (317 migrations, 77 edge functions, money-flow, kill switches, Flywheel, Oracle, Hyperion). Not the 572-component frontend.

### Recommended path: **Greenfield Lovable project + reuse Supabase + cherry-pick ~5% of code**

#### A. New project bootstrap (on new GitHub account)

1. Create a brand-new Lovable project under the new GitHub account. Default Vite/React/TS template.
2. Connect it via Lovable Cloud (auto-spins a fresh Supabase). Then **migrate the existing backend** into it using the runbook already in this repo:
   - `scripts/independence/01-prepare.sh` (link new ref)
   - `scripts/independence/02-pull-and-diff.sh` (review what's already there vs the 317 migrations)
   - `scripts/independence/03-deploy.sh` (push migrations + deploy 77 edge functions)
   - `scripts/independence/04-data-copy.sh` (only if you want live data; otherwise start clean)
   - `scripts/independence/secrets-checklist.txt` (set all secrets)
   - **Alternative if you want a fresh DB:** skip step 2 entirely and only port the migrations you care about (auth, profiles, wallet, deposits/withdrawals, kill switches). Drop Imperial Duel, Flywheel, Oracle, Founding Seats, VIP, Crown, NFT — these are huge surface area and unproven product/market fit.

3. In the new project, set canonical domain guard back on from day 1.

#### B. KEEP (cherry-pick from current repo)

- `src/integrations/supabase/client.ts` (re-generated by Cloud — don't copy by hand)
- `src/lib/notify.ts`, `src/lib/glossary.ts`, `src/lib/displayCurrency.ts`
- `@pkg/core` (i18n glossary, storage keys)
- `@pkg/realtime` (4-partition wrapper) — the architecture is sound
- `@pkg/wallet` (hooks + components — deposits/withdrawals UX is the most polished surface)
- `src/components/ui/*` (shadcn primitives)
- Tailwind tokens / `index.css` design system (Imperial tokens, gradients, glow, halo)
- `e2e/` Playwright fixtures (selectors will need updating but the scaffolding is good)
- `.github/workflows/` (bundle-budget, perf-gate, db-permissions — port these)
- All `supabase/migrations/` you choose to keep + matching `supabase/functions/`

#### C. DELETE / DO NOT PORT

- `src/App.tsx` placeholder (write a new minimal router).
- 131 legacy pages — port only what the new 3-flow product needs.
- 572 components — re-derive from the 3 flows; expect <100 to survive.
- All `V2`/`V3`/`Legacy` files.
- `src/packages/apex/*`, `src/packages/duel/*`, `src/packages/games/*` unless you are explicitly shipping those games on day 1.
- `phonara-unicorn` (already gone).
- `lovable-tagger` if you don't want Lovable's hover-to-edit overlays in the new project (decision call).

#### D. REWRITE from scratch in the new project

- **The 3 user flows.** Pick them now. Concrete suggestion based on what's actually monetised today:
  1. **WALLET** — deposit (crypto + KRW + voucher), withdraw with AAL2, balance, history.
  2. **PLAY** — one game surface (start with Olympus 5000 or Imperial Duel — pick one).
  3. **EARN** — referrals, missions, attendance streak.
- One shell (`<Shell>`), one nav, one toast system (`@/lib/notify`), one realtime channel layer.
- React Query for every server read. No raw `useEffect` + `supabase.from`.
- Operator/admin in a **separate Lovable project** entirely (or a hidden `/ops` subroute behind AAL2 — but don't ship it in v1).

#### E. Target architecture (new project)

```text
src/
├── App.tsx                ~80 LOC, lazy routes only
├── main.tsx               ~40 LOC, domain guard ON
├── routes/                3 top-level: /wallet  /play  /earn
├── shell/                 Shell, Nav, BottomTabs
├── features/
│   ├── auth/              login, callback, AAL2 step-up
│   ├── wallet/            deposit, withdraw, history
│   ├── play/              single game integration
│   └── earn/              referral, mission, streak
├── packages/
│   ├── core/              i18n, storage keys, notify, glossary
│   ├── realtime/          4-partition wrapper (ported)
│   └── ui/                shadcn primitives + design tokens
├── integrations/supabase/ auto-generated
└── lib/                   thin utilities only
```

Target metrics:
- ≤ **15,000 LOC** total (was 147,747 — 10× cut).
- ≤ **40 pages** (was 131).
- ≤ **120 components** (was 572).
- ≤ **180 KB** gzipped initial bundle (current budget already enforced — port the gate).
- 1 admin/ops subroute or 0 (preferred).

#### F. Migration order (suggested)

```text
Week 1  New Lovable project + connect Cloud + canonical domain + auth
Week 2  Wallet (deposit/withdraw + AAL2) ported from @pkg/wallet
Week 3  One game surface end-to-end with money-flow RPC
Week 4  Earn (referral/mission/streak) + bundle gate + e2e
Week 5  Cut over DNS; freeze the old project (don't delete — keep as cold archive)
```

#### G. What to do with **this** (old) repo

- Tag the current commit `v-legacy-final` so the backend history is preserved.
- Lock the old Lovable project to read-only / pause Cloud after migration.
- Keep `scripts/independence/` and the 317 migrations until the new project is verified in production.
- Do **not** try to "fix" App.tsx here. Sunk cost.

---

## What I need from you before executing

1. **Confirm greenfield** — start the new Lovable project under the new GitHub account; this repo becomes archival only. (Yes/No)
2. **Backend strategy** — (a) port all 317 migrations + 77 edge functions to the new Supabase ref, OR (b) port only Wallet + Auth + Profiles and drop Imperial/Flywheel/Oracle/Empire/VIP. (a/b)
3. **3 flows** — confirm Wallet / Play / Earn, or name your three.
4. **Single game choice** — Olympus 5000, Imperial Duel, or none in v1.

Once you answer those four, I will produce the seed code spec for the new project (router + shell + auth + one feature slice) as a follow-up plan you can paste straight into the new Lovable project's first prompt.
