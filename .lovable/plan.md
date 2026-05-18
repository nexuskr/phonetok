# Phonara.world — Ultimate E2E Testing Framework (Phase 1: Architecture Proposal)

> 목표: Stake / Rollbit / Bybit / Binance 를 압도하는 **단일 통합 E2E + Chaos + Network + HAR + Contract + Security + Resilience** 프레임워크.
> 핵심 원칙: **Money-flow 8경로 0-byte FREEZE**, **Operator Isolation**, **Client→DB 직접 조작 불가 증명**, **불변 가드 0 bytes**.

---

## 0. 사전 합의가 필요한 의사결정 (Phase 2 진입 전 확인)

1. 실행 환경 — **Lovable preview 도메인** 만 대상으로 할지, `phonara.world` (production) 도 야간 cron 으로 돌릴지?
2. 테스트 계정 정책 — `e2e_seed_user_create()` 류 RPC 를 신규로 만들 수 있나? (현재 DB에는 없음 — money-flow 0-byte FREEZE 와 분리된 별도 스키마 `e2e.*` 로 격리 권장)
3. CI 실행 — GitHub Actions runner 만 쓸지, self-hosted runner (Asia region) 도 둘지? (Chaos 계열은 latency 민감)
4. Secret Rotation 의 "Primary" 가 GitHub repository secrets 인지, GitHub Environment secrets 인지, 아니면 Lovable Cloud 의 secrets 인지? (Fallback 계층의 출발점이 달라짐)

위 4개는 Phase 2 작성 직전에 ask_questions 로 다시 확인합니다.

---

## 1. Architecture Proposal (한 장 요약)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                  Phonara E2E Imperial Test Framework                    │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐  │
│  │  Playwright  │   │  fast-check  │   │   Newman /   │   │  Chaos   │  │
│  │  (browser)   │   │ (property)   │   │   Postman    │   │ Injector │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └────┬─────┘  │
│         │                  │                  │                │        │
│         └──────────┬───────┴────────┬─────────┴────────┬───────┘        │
│                    │                │                  │                │
│              ┌─────▼─────┐    ┌─────▼─────┐      ┌─────▼─────┐          │
│              │  HAR /    │    │  Zod      │      │ Telemetry │          │
│              │  Network  │    │ Contract  │      │ Assertion │          │
│              │ Intercept │    │ Validator │      │ (client_  │          │
│              └─────┬─────┘    └─────┬─────┘      │ metrics)  │          │
│                    │                │             └─────┬─────┘          │
│                    └────────┬───────┴───────────────────┘                │
│                             │                                           │
│                   ┌─────────▼──────────┐                                │
│                   │ SecretRotationMgr  │  ← 5-layer fallback            │
│                   │ + AuditTrail       │                                │
│                   └─────────┬──────────┘                                │
│                             │                                           │
│         ┌───────────────────┼───────────────────────┐                   │
│         │                   │                       │                   │
│   ┌─────▼─────┐       ┌─────▼─────┐           ┌─────▼─────┐             │
│   │ Preview   │       │ Supabase  │           │ Edge Fns  │             │
│   │ (browser) │       │ (RLS only)│           │ (verify_  │             │
│   │           │       │ — anon ky │           │  jwt)     │             │
│   └───────────┘       └───────────┘           └───────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 폴더 구조 (Phase 2 확정안)

```text
e2e/
├── playwright.config.ts          # 5 projects: chromium-desktop, mobile-ios, mobile-android, low-end, chaos
├── global-setup.ts               # SecretRotationManager 부팅 + auth state 캐싱
├── fixtures/
│   ├── auth.fixture.ts           # storageState 재사용 (admin / user / fresh / aal2)
│   ├── network.fixture.ts        # request interception + HAR recorder
│   ├── chaos.fixture.ts          # latency / offline / 5xx injector
│   └── telemetry.fixture.ts      # client_metrics & error_log assertion helper
├── factories/                    # fast-check arbitraries
│   ├── money.ts                  # PHON/KRW/USDT amount generators
│   ├── duel.ts                   # imperial_duel bet generator
│   └── user.ts
├── contracts/                    # Zod schemas mirroring 64 edge functions + RPCs
│   ├── imperial-metrics-batch.ts
│   ├── imperial-lobby-analytics.ts
│   ├── imperial-place-phon-bet.ts
│   └── ... (auto-generated baseline + manual)
├── har/
│   ├── recorder.ts               # context.routeFromHAR + tracing
│   ├── parser.ts                 # HAR JSON → typed entries
│   └── validator.ts              # parsed entries × Zod contracts
├── postman/
│   ├── generator.ts              # Playwright trace → Postman v2.1 collection
│   ├── environments/             # dev.json / preview.json / prod.json (templated)
│   └── newman-runner.ts          # newman.run wrapper + secret injection
├── secrets/
│   ├── SecretRotationManager.ts  # ★ Phase 1 핵심 — 아래 §3 참조
│   ├── policy.ts                 # FallbackPolicy 정의
│   ├── audit.ts                  # append-only audit log writer
│   └── pool/                     # Layer-2 격리 secret pool (encrypted at rest, git-ignored)
├── suites/
│   ├── 01-smoke/                 # health, auth, home render
│   ├── 02-money-flow/            # 8경로 — 절대 mutate 금지, observe-only 모드
│   ├── 03-imperial-duel/         # Phase 4 P1 Observer Mode 검증
│   ├── 04-operator-isolation/    # /admin chunk leak 0 증명
│   ├── 05-rls-direct/            # anon client → 220+ 테이블 INSERT/UPDATE 거부 증명
│   ├── 06-chaos/                 # network / oracle / kill-switch chaos
│   ├── 07-har-contract/          # HAR replay + Zod validation
│   ├── 08-postman-contract/      # Newman CLI 통합
│   ├── 09-telemetry/             # web-vitals, FPS, sampling 검증
│   └── 10-security/              # CSP, headers, secret leak scan, dependency drift
├── reporters/
│   ├── imperial-html.ts          # custom report (sprint-style)
│   └── slack-alert.ts            # fallback 발생 시 즉시 알림
└── scripts/
    ├── rotate-secrets.ts         # cron / manual
    ├── refresh-har-baseline.ts
    └── verify-money-flow-diff.ts # git diff 0-byte gate
```

### 1.2 Playwright projects (Phase 2 detail)

| Project | Browser | Viewport | DPR | Throttle | Use |
|---|---|---|---|---|---|
| `desktop-chromium` | chromium | 1440×900 | 1 | none | suites 01,04,05,07,08,10 |
| `mobile-ios` | webkit | 390×844 | 3 | 4G | suites 01,03,09 |
| `mobile-android` | chromium | 412×915 | 2.625 | 3G | suites 01,03,09 |
| `low-end` | chromium | 360×640 | 2 | slow-3G + CPU×6 | suites 03,06,09 |
| `chaos` | chromium | 1440×900 | 1 | scripted | suite 06 only |

---

## 2. Secret Rotation Automation 전략

### 2.1 회전 대상 (Tier 분류)

| Tier | Secret | 회전 주기 | Primary | Fallback Layer 적용 |
|---|---|---|---|---|
| T0 (CRITICAL) | `SUPABASE_SERVICE_ROLE_KEY` | 분기 + 즉시(누출) | Lovable Cloud UI | Layer 1~5 전부 |
| T0 | `Admin JWT (AAL2 session)` | 24h | Edge fn 발급 | Layer 1~3 |
| T1 | `VITE_SUPABASE_PUBLISHABLE_KEY` | 연 1회 | Lovable Cloud UI | Layer 1~2 |
| T1 | `BOT_CRON_SECRET` | 분기 | GH Secret | Layer 1~3 |
| T2 | `E2E_USER_PASSWORD` | 주 1회 | GH Secret | Layer 1~4 |
| T2 | `LOVABLE_API_KEY` | on-demand | `ai_gateway--rotate_lovable_api_key` 전용 | Layer 1~2 |
| T3 | OAuth/JWT secret | 수동 | Cloud UI | Layer 1 only |

### 2.2 Primary 자동 회전 흐름

```text
cron(@weekly) ─▶ rotate-secrets.ts
                    │
                    ├─▶ Lovable Cloud API (rotate)
                    ├─▶ Update GitHub repo/env secrets via gh api
                    ├─▶ Write fingerprint(last6) to service_key_rotations table
                    ├─▶ Smoke test: call admin_run_rls_smoke() with new key
                    └─▶ on FAIL → trigger FallbackPolicy.escalate()
```

---

## 3. Secret Rotation Fallback Strategies (Multi-layer)

### 3.1 5-Layer 정책

```text
┌──────────────────────────────────────────────────────────────┐
│ Layer 0: PRIMARY                                             │
│   - Fresh rotated secret (just minted)                       │
│   - smoke test PASS 시에만 promote                            │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: CACHED PREVIOUS (1-shot)                            │
│   - 직전 valid secret (in-memory + ~/.phonara/cache, 600 TTL)│
│   - 1회만 사용 → 사용 즉시 invalidate                         │
│   - Money-flow suite: 사용 허용 (read-only RPC만)             │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: SAFE DEFAULT POOL                                   │
│   - secrets/pool/ — rotation 전용 격리 계정 (3개 rolling)     │
│   - 별도 Supabase project? → 권장: 동일 project + scope 제한  │
│   - Admin RPC 호출 금지, anon 권한만                          │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: READ-ONLY MODE                                      │
│   - process.env.E2E_READONLY=1                               │
│   - SUITE_ALLOWLIST=[01-smoke, 07-har-contract(replay only)] │
│   - Money-flow / Admin / RLS-mutate suite → auto-skip        │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: EMERGENCY STATIC                                    │
│   - 마지막으로 알려진 valid secret (encrypted, manual only)   │
│   - 사용 즉시 PagerDuty + Slack red alert                    │
│   - 최대 30분 후 강제 만료                                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: ULTIMATE FAIL                                       │
│   - Skip all + CI exit 78 (neutral) + Detailed alert         │
│   - admin_audit_log INSERT (kind='e2e_secret_ultimate_fail') │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 SecretRotationManager (전체 코드 — TypeScript)

```typescript
// e2e/secrets/SecretRotationManager.ts
import { z } from "zod";
import { writeAudit } from "./audit";
import { FallbackPolicy, policyFor } from "./policy";

export type Tier = "T0" | "T1" | "T2" | "T3";
export type Layer = 0 | 1 | 2 | 3 | 4 | 5;

export interface SecretRecord {
  name: string;
  tier: Tier;
  value: string;
  fingerprint: string;
  mintedAt: number;
  source: "primary" | "cache" | "pool" | "static";
  layer: Layer;
}

export interface SmokeResult { ok: boolean; reason?: string; }

const SmokeSchema = z.object({ ok: z.boolean(), reason: z.string().optional() });

export class SecretRotationManager {
  private cache = new Map<string, SecretRecord>();      // Layer 1
  private prevValid = new Map<string, SecretRecord>();  // 직전 성공
  private metrics = { fallbackByLayer: [0, 0, 0, 0, 0, 0] };

  constructor(
    private readonly fetchPrimary: (name: string) => Promise<string>,
    private readonly smoke: (rec: SecretRecord) => Promise<SmokeResult>,
    private readonly pool: (name: string) => Promise<string | null>,
    private readonly emergency: (name: string) => Promise<string | null>,
    private readonly alert: (msg: string, level: "warn" | "red") => Promise<void>,
  ) {}

  /** 호출자(테스트 fixture)는 이 함수만 사용 */
  async resolve(name: string, tier: Tier): Promise<SecretRecord> {
    const policy = policyFor(tier);
    let lastErr: string | undefined;

    for (const layer of policy.layers) {
      try {
        const rec = await this.tryLayer(name, tier, layer);
        if (!rec) continue;
        const s = SmokeSchema.parse(await this.smoke(rec));
        if (!s.ok) { lastErr = `smoke_fail:${s.reason}`; continue; }

        if (layer > 0) {
          this.metrics.fallbackByLayer[layer]++;
          await writeAudit({
            kind: "fallback_used", name, tier, layer,
            fingerprint: rec.fingerprint, ts: Date.now(),
          });
          await this.alert(
            `Secret ${name} resolved via Layer ${layer} fallback`,
            layer >= 4 ? "red" : "warn",
          );
        }
        if (layer <= 1) this.prevValid.set(name, rec);
        return rec;
      } catch (e: any) {
        lastErr = String(e?.message ?? e);
      }
    }

    // Layer 5
    this.metrics.fallbackByLayer[5]++;
    await writeAudit({ kind: "ultimate_fail", name, tier, lastErr, ts: Date.now() });
    await this.alert(`SECRET ULTIMATE FAIL: ${name} (${lastErr})`, "red");
    throw new Error(`secret_ultimate_fail:${name}`);
  }

  private async tryLayer(name: string, tier: Tier, layer: Layer): Promise<SecretRecord | null> {
    switch (layer) {
      case 0: {
        const v = await this.fetchPrimary(name);
        return this.mk(name, tier, v, "primary", 0);
      }
      case 1: {
        const cached = this.cache.get(name) ?? this.prevValid.get(name);
        if (!cached) return null;
        this.cache.delete(name);              // 1-shot
        return { ...cached, layer: 1, source: "cache" };
      }
      case 2: {
        const v = await this.pool(name);
        return v ? this.mk(name, tier, v, "pool", 2) : null;
      }
      case 3: {
        process.env.E2E_READONLY = "1";
        process.env.E2E_SUITE_ALLOWLIST = "01-smoke,07-har-contract:replay";
        const v = this.prevValid.get(name)?.value ?? "";
        if (!v) return null;
        return this.mk(name, tier, v, "cache", 3);
      }
      case 4: {
        const v = await this.emergency(name);
        if (!v) return null;
        setTimeout(() => this.invalidate(name), 30 * 60_000);
        return this.mk(name, tier, v, "static", 4);
      }
      case 5: return null;
    }
  }

  private mk(name: string, tier: Tier, value: string, source: SecretRecord["source"], layer: Layer): SecretRecord {
    return {
      name, tier, value, source, layer,
      fingerprint: value.slice(-6),
      mintedAt: Date.now(),
    };
  }

  invalidate(name: string) { this.cache.delete(name); this.prevValid.delete(name); }
  snapshotMetrics() { return { ...this.metrics }; }
}
```

### 3.3 FallbackPolicy 설정 예시

```typescript
// e2e/secrets/policy.ts
import type { Tier, Layer } from "./SecretRotationManager";

export interface FallbackPolicy {
  layers: Layer[];                // 시도할 순서
  maxFallbackPerRun: number;
  forbidSuitesOnFallback?: string[]; // suite glob
}

const T0: FallbackPolicy = {
  layers: [0, 1, 2, 3, 4, 5],
  maxFallbackPerRun: 1,
  forbidSuitesOnFallback: ["02-money-flow/*-mutate", "04-operator-isolation/admin-write"],
};
const T1: FallbackPolicy = { layers: [0, 1, 2, 5], maxFallbackPerRun: 2 };
const T2: FallbackPolicy = { layers: [0, 1, 2, 3, 5], maxFallbackPerRun: 3 };
const T3: FallbackPolicy = { layers: [0, 5], maxFallbackPerRun: 0 };

export function policyFor(tier: Tier): FallbackPolicy {
  return ({ T0, T1, T2, T3 } as const)[tier];
}
```

### 3.4 GitHub Actions 예시 (Fallback-aware)

```yaml
# .github/workflows/e2e-imperial.yml
name: E2E Imperial
on: { schedule: [{ cron: "17 */6 * * *" }], workflow_dispatch: }
jobs:
  e2e:
    runs-on: ubuntu-latest
    env:
      E2E_BASE_URL: https://id-preview--c7a12cd6-13f6-4ce6-bf31-cc578b215a4b.lovable.app
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      E2E_POOL_USER_A: ${{ secrets.E2E_POOL_USER_A }}
      E2E_POOL_USER_B: ${{ secrets.E2E_POOL_USER_B }}
      E2E_EMERGENCY_STATIC: ${{ secrets.E2E_EMERGENCY_STATIC }}
      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium webkit
      - name: Rotate (best-effort)
        id: rotate
        continue-on-error: true
        run: bun run e2e/scripts/rotate-secrets.ts
      - name: Run E2E (with fallback)
        id: run
        run: bunx playwright test
      - name: Newman contracts
        if: always()
        run: bun run e2e/postman/newman-runner.ts
      - name: Publish report
        if: always()
        uses: actions/upload-artifact@v4
        with: { name: imperial-report, path: e2e/reports/ }
      - name: Detect fallback usage
        if: always()
        run: |
          node -e "
            const m=require('./e2e/reports/metrics.json');
            const fb=m.fallbackByLayer.slice(2).reduce((a,b)=>a+b,0);
            if(fb>0){console.log('::warning::fallback used '+fb+' times'); process.exit(0)}
          "
      - name: Neutral exit on ULTIMATE_FAIL
        if: failure() && contains(steps.run.outputs.reason, 'secret_ultimate_fail')
        run: exit 78
```

### 3.5 Alert & Logging 전략

- **Logging**: `e2e/reports/rotation-failed-<ts>.log` (JSONL, append-only). 매 fallback 1줄 = `{ts,name,tier,layer,fingerprint,reason}`.
- **Audit (DB)**: 새 테이블 `e2e_secret_audit` (admin-only RLS, 신규 migration) — append-only, fingerprint(last 6) + tier + layer + suite.
- **Realtime alert**:
  - Layer 2~3 → Slack `#imperial-e2e` (warn 톤)
  - Layer 4~5 → Slack red + PagerDuty + `anomaly_events`(rule=`e2e_secret_fallback`)
- **Visibility (Report)**: HTML 리포트 헤더에 Layer 별 카운트 배지 + Sparkline (최근 30 run).

### 3.6 Fallback Mode 의 Test Execution Control

```typescript
// e2e/fixtures/auth.fixture.ts (발췌)
test.beforeAll(async () => {
  if (process.env.E2E_READONLY === "1") {
    const allow = (process.env.E2E_SUITE_ALLOWLIST ?? "").split(",");
    const cur = test.info().titlePath[0];
    if (!allow.some(g => cur.startsWith(g.split(":")[0]))) {
      test.skip(true, `read-only fallback active → ${cur} disabled`);
    }
  }
});
```

- Money-flow suite 는 `tag:@mutates-money` 가 붙고, **Layer ≥ 2** 부터 자동 skip.
- Admin / AAL2 suite 는 `tag:@admin` — **Layer ≥ 1** 부터 skip (Layer 1 cache 도 admin 권한엔 부족).
- Chaos suite 는 Fallback Mode 와 직교 — chaos 시나리오가 secret 회전 실패를 일부러 유발할 수 있으므로 `chaosOrchestrator.expectFallback(layer)` API 로 합법화.

### 3.7 강조 영역 별 처리

1. **High-privilege secret (Service Role / Admin JWT)**: Layer 1 cache 도 service_role 은 **fingerprint 검증 + 만료 30초** 강제. Admin JWT 는 cache 금지, 항상 Layer 0 또는 Layer 5.
2. **Money Flow 중 회전 실패**: 진행 중인 테스트가 있으면 `manager.invalidate()` 호출 전 현재 spec 완주 → 다음 spec 부터 read-only. 절대 mid-flight 키 교체 금지.
3. **Chaos 환경**: `chaos.fixture` 가 secret 실패를 의도적으로 주입하면 `manager.expectFallback(layer)` 를 미리 호출 — 그 layer 까지의 alert 는 warn 으로 down-grade.
4. **CI/CD 안정성**: ULTIMATE_FAIL 은 `exit 78` (neutral) 로 다른 워크플로 영향 차단. 단 main branch 는 exit 1.
5. **즉각 Visibility**: HTML 리포트 + Slack thread + GitHub job summary 3채널 동시 송출.

---

## 4. Phase 2~7 요약 (이번 plan 승인 후 순차 진행)

- **Phase 2**: 폴더 골격 + `playwright.config.ts` (5 projects) + `postman/environments/*.json` 템플릿 + `newman-runner.ts` 부트스트랩.
- **Phase 3**: Factories(fast-check) + HAR recorder/parser/validator + Zod contracts (imperial-metrics-batch / imperial-lobby-analytics 먼저, 나머지 RPC 는 `rpc.surface.*.json` 베이스라인에서 자동 생성) + Postman generator + SecretRotationManager 실배선.
- **Phase 4**: Core suites 01·02·03·04·05.
- **Phase 5**: Chaos / Network / HAR / Postman-Newman 전용 suite (06·07·08).
- **Phase 6**: Financial integrity (money-flow diff gate) + Security (CSP/headers/leak scan) + Telemetry (client_metrics × admin_get_lobby_analytics 교차검증).
- **Phase 7**: Newman CLI + Secret rotation cron + Multi-layer fallback wiring + GitHub Actions matrix + custom HTML reporter + 유지보수 가이드.

## 5. 불변 가드 (모든 Phase 공통)

- `scripts/check-money-flow-freeze.mjs` 가 PR CI 에서 8경로 git diff = 0 검증 — E2E PR 도 예외 없음.
- `scripts/check-operator-isolation.mjs` 가 `index-*.js` 에 operator marker 0 검증.
- `dependency-cruiser` 규칙에 `e2e/**` → `src/**` import 금지 (단방향).
- 신규 DB 객체는 **`e2e_*` prefix 의 admin-only RLS 테이블** 만 허용. `public.*` money 테이블 신규 컬럼/트리거 0.

---

## 6. 산출물 (Phase 1 종료 시점)

- 본 문서 (`.lovable/plan.md`) — Architecture / Rotation / Fallback / Manager 전체 코드 / Policy / GH workflow / Alert / Execution control 포함.
- 다음 turn 에서 Phase 2 부터는 실제 파일 생성 시작.
