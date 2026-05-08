#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * scripts/security-lint.ts
 * Runs the Supabase database linter via the Management API and prints a summary.
 * Intended to be run weekly/biweekly as a CI/cron operations script (NOT shipped to clients).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=xxx PROJECT_REF=ketlqzfaplppmupaiwft deno run -A scripts/security-lint.ts
 */
const TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const REF = Deno.env.get("PROJECT_REF") ?? "ketlqzfaplppmupaiwft";

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN env var");
  Deno.exit(2);
}

const url = `https://api.supabase.com/v1/projects/${REF}/database/lints`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
if (!res.ok) {
  console.error("Linter API error:", res.status, await res.text());
  Deno.exit(1);
}

const lints = (await res.json()) as Array<{
  name: string;
  level: "INFO" | "WARN" | "ERROR";
  description: string;
  detail?: string;
}>;

const errors = lints.filter((l) => l.level === "ERROR");
const warns = lints.filter((l) => l.level === "WARN");

console.log(`📊 Supabase Linter — ${lints.length} findings (${errors.length} ERROR, ${warns.length} WARN)`);
for (const l of errors) console.log(`❌ [${l.level}] ${l.name}: ${l.description}`);
for (const l of warns) console.log(`⚠️  [${l.level}] ${l.name}`);

Deno.exit(errors.length > 0 ? 1 : 0);
