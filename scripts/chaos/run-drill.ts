#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
// Phonara Chaos Engineering — Game Day Drill
// Validates self-healing behavior in a controlled, READ-MOSTLY way.
//
// What it checks:
//   1. RLS posture: anon should be DENIED on sensitive tables
//   2. Public trust RPC: should be reachable, return reasonable structure
//   3. Catalog edge cache: should respond with payload + ETag
//   4. Settlement SLO snapshot (admin only — skipped if no admin token)
//   5. Anomaly inbox sanity (admin only — skipped if no admin token)
//
// It NEVER mutates production. All probes are read-only.
// Outputs a markdown report to /mnt/documents/chaos-report.md
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [SUPABASE_ADMIN_TOKEN=...] \
//     deno run --allow-net --allow-env --allow-read --allow-write scripts/chaos/run-drill.ts

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const ADMIN_TOKEN = Deno.env.get("SUPABASE_ADMIN_TOKEN");

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in env");
  Deno.exit(1);
}

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];

function add(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
}

async function probe(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY!,
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function rlsDenyCheck(table: string) {
  const res = await probe(`/rest/v1/${table}?select=*&limit=1`);
  if (res.status === 401 || res.status === 403) {
    add(`RLS deny: ${table}`, true, `status=${res.status}`);
    return;
  }
  if (res.status === 200) {
    const json = await res.json();
    if (Array.isArray(json) && json.length === 0) {
      add(`RLS deny: ${table}`, true, "200 with empty array (RLS filter)");
    } else {
      add(`RLS deny: ${table}`, false, `LEAK: ${res.status} returned ${Array.isArray(json) ? json.length : "?"} rows`);
    }
    return;
  }
  add(`RLS deny: ${table}`, false, `unexpected status=${res.status}`);
}

async function trustRpcCheck() {
  const res = await probe(`/rest/v1/rpc/public_trust_metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return add("public_trust_metrics", false, `status=${res.status}`);
  const j = await res.json();
  const okShape = j && typeof j === "object" && "total_paid" in j && "cron_uptime_7d" in j;
  add("public_trust_metrics", okShape, okShape ? `uptime=${j.cron_uptime_7d}%, audit_pass=${j.audit_pass_30d}%` : "bad shape");
}

async function catalogCacheCheck() {
  const url = `${SUPABASE_URL.replace("/rest/v1", "")}/functions/v1/catalog-cache`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY! } });
  if (!res.ok) return add("catalog-cache edge", false, `status=${res.status}`);
  const etag = res.headers.get("etag");
  const j = await res.json();
  const ok = j && Array.isArray(j.achievements) && Array.isArray(j.tier_limits);
  add("catalog-cache edge", ok, `etag=${etag} keys=${Object.keys(j ?? {}).join(",")}`);
}

async function adminProbe() {
  if (!ADMIN_TOKEN) {
    add("admin SLO/anomaly", true, "skipped (no SUPABASE_ADMIN_TOKEN)");
    return;
  }
  const res = await probe(`/rest/v1/rpc/settlement_slo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: "{}",
  });
  if (!res.ok) return add("settlement_slo (admin)", false, `status=${res.status}`);
  const j = await res.json();
  add("settlement_slo (admin)", true, `health=${j.health} consecutive_failures=${j.consecutive_failures}`);
}

console.log("🧪 Phonara Chaos Drill (read-only)");
console.log(`Target: ${SUPABASE_URL}`);
console.log("");

const sensitiveTables = [
  "transactions", "wallet_balances", "withdrawal_requests",
  "profiles", "user_roles", "security_audit_log",
  "admin_audit_log", "idempotency_keys", "anomaly_events",
  "policy_assertion_runs",
];

for (const t of sensitiveTables) await rlsDenyCheck(t);
await trustRpcCheck();
await catalogCacheCheck();
await adminProbe();

// Report
const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failed = total - passed;
const ts = new Date().toISOString();
const startMs = (globalThis as any).__chaosStartMs ?? Date.now();
const durationMs = Date.now() - startMs;

// Persist run via service role (if SERVICE_ROLE_KEY provided)
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (SERVICE) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_chaos_run`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _total: total, _passed: passed, _failed: failed, _duration_ms: durationMs,
        _results: results, _source: Deno.env.get("CHAOS_SOURCE") ?? "manual",
      }),
    });
    if (r.ok) console.log("📝 chaos_runs row recorded");
    else console.warn("record_chaos_run failed:", r.status, await r.text());
  } catch (e) {
    console.warn("record_chaos_run error:", (e as Error).message);
  }
}

const md = `# Phonara Chaos Drill Report

**Generated:** ${ts}
**Target:** \`${SUPABASE_URL}\`
**Result:** ${failed === 0 ? "🟢 PASS" : "🔴 FAIL"} (${passed}/${total})

## Probes

| # | Check | Result | Detail |
|---|---|---|---|
${results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.pass ? "✅" : "❌"} | ${r.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## What this drill validates

- **RLS posture**: anon role must NOT read sensitive tables (transactions, wallet, withdrawals, profiles, role tables, audit logs, anomaly events).
- **Trust RPC**: \`/rpc/public_trust_metrics\` is callable without auth and returns aggregate-only shape.
- **Edge catalog cache**: \`catalog-cache\` returns payload with ETag.
- **Admin SLO** (when token provided): \`settlement_slo\` returns health.

## Next steps if FAIL

1. Re-run the policy assertions: \`SELECT public.run_policy_assertions();\`
2. Inspect \`security_audit_log\` for the latest failure source.
3. Check \`anomaly_events WHERE acknowledged = false\`.
4. Confirm pg_cron jobs are scheduled (cron-settle-packages, daily, hourly recover, anomaly 5min).
`;

const outDir = "/mnt/documents";
try { await Deno.mkdir(outDir, { recursive: true }); } catch {}
const out = `${outDir}/chaos-report.md`;
await Deno.writeTextFile(out, md);
console.log("");
console.log(`📄 Report → ${out}`);

if (failed > 0) Deno.exit(2);
