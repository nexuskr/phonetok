#!/usr/bin/env node
/**
 * PR-L — Per-route bundle budget gate.
 *
 * Reads size-limit.config.json, scans dist/assets/*.js, groups files per pattern,
 * compares gzip size (max or sum per group) against the configured budget.
 *
 * Outputs:
 *   - stdout table (PASS/FAIL/WARN)
 *   - reports/bundle-budget.<YYYY-MM-DD>.json
 *   - reports/bundle-budget.latest.json (rolling)
 *   - reports/bundle-budget.comment.md  (sticky PR comment body)
 *
 * Flags:
 *   --baseline <path>   compare against an older snapshot for delta column
 *
 * Exits 1 if any non-warn budget is exceeded.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const ASSETS = join(DIST, "assets");
const CONFIG = join(ROOT, "size-limit.config.json");
const REPORTS = join(ROOT, "reports");

const argv = process.argv.slice(2);
const baselineFlag = argv.indexOf("--baseline");
const baselinePath =
  baselineFlag >= 0 ? argv[baselineFlag + 1] : join(REPORTS, "bundle-budget.prev.json");

const KB = (n) => (n / 1024).toFixed(1) + " KB";
const KB_NUM = (n) => +(n / 1024).toFixed(2);

if (!existsSync(ASSETS)) {
  console.error(`[bundle-budget] ${ASSETS} not found — run \`vite build\` first.`);
  process.exit(2);
}
if (!existsSync(CONFIG)) {
  console.error(`[bundle-budget] ${CONFIG} missing.`);
  process.exit(2);
}

const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));

const sized = files.map((f) => {
  const raw = readFileSync(join(ASSETS, f));
  return { file: f, raw: raw.length, gz: gzipSync(raw).length };
});

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;
const baselineByName = new Map(
  (baseline?.groups ?? []).map((g) => [g.name, g.measured_kb]),
);

const results = [];
let failed = 0;

for (const b of cfg.budgets) {
  const re = new RegExp(b.pattern);
  const matched = sized.filter((s) => re.test(s.file));
  let measured = 0;
  if (b.aggregate === "sum") {
    measured = matched.reduce((a, s) => a + s.gz, 0);
  } else {
    measured = matched.reduce((a, s) => Math.max(a, s.gz), 0);
  }
  const limitBytes = b.limit_kb * 1024;
  const over = measured > limitBytes;
  const status = matched.length === 0 ? "—" : over ? (b.warn_only ? "WARN" : "FAIL") : "PASS";
  if (over && !b.warn_only) failed++;
  const baseKb = baselineByName.get(b.name);
  const delta = baseKb != null ? KB_NUM(measured) - baseKb : null;
  results.push({
    name: b.name,
    pattern: b.pattern,
    aggregate: b.aggregate,
    warn_only: !!b.warn_only,
    limit_kb: b.limit_kb,
    measured_kb: KB_NUM(measured),
    file_count: matched.length,
    files: matched.map((m) => ({ file: m.file, gz_kb: KB_NUM(m.gz) })),
    delta_kb: delta,
    status,
  });
}

// ── stdout report ─────────────────────────────────────────────────────────
console.log("\n=== PR-L · Per-route Bundle Budget ===\n");
console.log(
  "  STATUS  " +
    "BUDGET".padStart(9) +
    "  " +
    "ACTUAL".padStart(9) +
    "  " +
    "Δ vs prev".padStart(10) +
    "  ROUTE",
);
console.log("  " + "─".repeat(72));
for (const r of results) {
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : r.status === "WARN" ? "⚠️ " : "··";
  const delta = r.delta_kb == null ? "  —" : (r.delta_kb > 0 ? "+" : "") + r.delta_kb + " KB";
  console.log(
    `  ${icon}  ${(r.limit_kb + " KB").padStart(9)}  ${(r.measured_kb + " KB").padStart(9)}  ${delta.padStart(10)}  ${r.name} (${r.file_count})`,
  );
}
console.log();

// ── persist reports ──────────────────────────────────────────────────────
if (!existsSync(REPORTS)) mkdirSync(REPORTS, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const snapshot = {
  generated_at: new Date().toISOString(),
  baseline: baseline ? baseline.generated_at : null,
  failed,
  groups: results,
};
const datedPath = join(REPORTS, `bundle-budget.${stamp}.json`);
writeFileSync(datedPath, JSON.stringify(snapshot, null, 2));
writeFileSync(join(REPORTS, "bundle-budget.latest.json"), JSON.stringify(snapshot, null, 2));

// ── PR comment markdown ──────────────────────────────────────────────────
const lines = [];
lines.push("### 📦 Bundle Budget — Phonara (PR-L)");
lines.push("");
lines.push(failed === 0 ? "✅ 모든 청크가 예산 안에 있습니다." : `❌ 예산 초과 ${failed}건 — 머지 차단됩니다.`);
lines.push("");
lines.push("| Route | Actual (gz) | Budget | Δ vs prev | Status |");
lines.push("|---|---:|---:|---:|:---:|");
for (const r of results) {
  const delta =
    r.delta_kb == null ? "—" : (r.delta_kb > 0 ? "🔺 +" : r.delta_kb < 0 ? "🟢 " : "") + r.delta_kb + " KB";
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : r.status === "WARN" ? "⚠️" : "·";
  lines.push(
    `| ${r.name} (${r.file_count}) | ${r.measured_kb} KB | ${r.limit_kb} KB | ${delta} | ${icon} |`,
  );
}
lines.push("");
lines.push(`<sub>snapshot: \`reports/bundle-budget.${stamp}.json\` · aggregate = max(single chunk) or sum(group)</sub>`);
writeFileSync(join(REPORTS, "bundle-budget.comment.md"), lines.join("\n") + "\n");

if (failed > 0) {
  console.error(`\n❌ FAIL: ${failed} route(s) over budget. See table above.`);
  process.exit(1);
}
console.log(`✅ PASS: all routes within budget. Snapshot → ${datedPath}`);
