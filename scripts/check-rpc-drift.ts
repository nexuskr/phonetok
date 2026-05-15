#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
/**
 * RPC Drift Guard
 * ---------------
 * 프론트엔드(`src/`)에서 호출하는 모든 `supabase.rpc("name", ...)` 이름이
 * 실제 DB(`pg_proc`)에 존재하는지 검증한다.
 *
 * - 직전 사고(spin_slot_demo 404, admin_cron_status 404)와 동일 클래스의
 *   "클라이언트가 부르지만 DB에 없는 RPC" 드리프트를 CI에서 영구 차단한다.
 *
 * 사용:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   deno run --allow-read --allow-net --allow-env scripts/check-rpc-drift.ts
 *
 * Exit code:
 *   0 — drift 없음
 *   1 — 드리프트 발견 (CI fail)
 */
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const SRC = new URL("../src/", import.meta.url).pathname;
const RPC_RE = /\.rpc\(\s*["'`]([a-z_][a-z0-9_]+)["'`]/g;

async function collectClientRpcNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const e of walk(SRC, {
    exts: [".ts", ".tsx"],
    skip: [/node_modules/, /\.test\./, /__tests__/, /\.d\.ts$/],
  })) {
    if (!e.isFile) continue;
    if (e.path.includes("/integrations/supabase/types.ts")) continue;
    const text = await Deno.readTextFile(e.path);
    for (const m of text.matchAll(RPC_RE)) names.add(m[1]);
  }
  return names;
}

async function fetchDbFunctionNames(): Promise<Set<string>> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("[drift] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    Deno.exit(2);
  }
  // pg_proc via PostgREST RPC: use a tiny SQL helper
  const res = await fetch(`${url}/rest/v1/rpc/list_public_function_names`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    console.error(`[drift] failed to fetch DB functions: ${res.status} ${await res.text()}`);
    Deno.exit(2);
  }
  const arr = (await res.json()) as Array<{ proname: string }>;
  return new Set(arr.map((r) => r.proname));
}

const [client, db] = await Promise.all([collectClientRpcNames(), fetchDbFunctionNames()]);
const missing = [...client].filter((n) => !db.has(n)).sort();

console.log(`[drift] client RPC names : ${client.size}`);
console.log(`[drift] db   RPC names : ${db.size}`);

if (missing.length === 0) {
  console.log("[drift] ✓ no drift — every client-called RPC exists in DB");
  Deno.exit(0);
}

console.error(`[drift] ✗ ${missing.length} RPC(s) called from client but missing in DB:`);
for (const n of missing) console.error(`  - ${n}`);
Deno.exit(1);
