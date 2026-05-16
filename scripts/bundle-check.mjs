#!/usr/bin/env node
/**
 * PHONARA Ω v3.1 — PHASE 1: Bundle size gate.
 *
 * Measures gzipped size of the entrypoint + main vendor chunks emitted to dist/.
 * Fails CI if Layer 1 (initial JS shipped on first paint) exceeds the budget.
 *
 * Budgets (gzip):
 *   Layer 1 initial JS   : 180 KB
 *   single chunk         : 250 KB (warn)
 *
 * Run:  node scripts/bundle-check.mjs
 */
import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const ASSETS = join(DIST, "assets");

const BUDGET_LAYER1_GZIP = 180 * 1024;
const WARN_SINGLE_CHUNK_GZIP = 250 * 1024;

function fmt(n) {
  return (n / 1024).toFixed(1) + " KB";
}

if (!existsSync(ASSETS)) {
  console.error(
    `[bundle-check] ${ASSETS} not found. Run \`vite build\` first.`,
  );
  process.exit(2);
}

// Parse index.html to find which JS files are loaded on first paint (Layer 1).
const indexHtml = readFileSync(join(DIST, "index.html"), "utf8");
const layer1Files = [
  ...indexHtml.matchAll(/<script[^>]+src="\/?([^"]+\.js)"/g),
  ...indexHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+\.js)"/g),
].map((m) => m[1]);

let layer1Total = 0;
const rows = [];

for (const rel of layer1Files) {
  const abs = join(DIST, rel);
  if (!existsSync(abs)) continue;
  const raw = readFileSync(abs);
  const gz = gzipSync(raw).length;
  layer1Total += gz;
  rows.push({ file: rel, raw: raw.length, gz });
}

rows.sort((a, b) => b.gz - a.gz);
console.log("\n=== Layer 1 chunks (loaded on first paint) ===");
for (const r of rows) {
  console.log(`  ${fmt(r.gz).padStart(10)} gz  ${fmt(r.raw).padStart(10)} raw   ${r.file}`);
}
console.log(`  ────────────────────────────────────────`);
console.log(`  ${fmt(layer1Total).padStart(10)} gz  TOTAL Layer 1`);
console.log(`  Budget: ${fmt(BUDGET_LAYER1_GZIP)}\n`);

// Also report largest chunks overall (for awareness).
const all = readdirSync(ASSETS)
  .filter((f) => f.endsWith(".js"))
  .map((f) => {
    const raw = readFileSync(join(ASSETS, f));
    return { file: f, raw: raw.length, gz: gzipSync(raw).length };
  })
  .sort((a, b) => b.gz - a.gz)
  .slice(0, 10);

console.log("=== Top 10 chunks by gzip size ===");
for (const r of all) {
  const warn = r.gz > WARN_SINGLE_CHUNK_GZIP ? "  ⚠ over single-chunk warn" : "";
  console.log(`  ${fmt(r.gz).padStart(10)} gz  ${fmt(r.raw).padStart(10)} raw   ${r.file}${warn}`);
}
console.log();

if (layer1Total > BUDGET_LAYER1_GZIP) {
  console.error(
    `\n❌ FAIL: Layer 1 = ${fmt(layer1Total)} gz exceeds budget ${fmt(BUDGET_LAYER1_GZIP)}.`,
  );
  console.error(`   PHASE 5 Layer 1 Diet rule: every KB matters on Android low-end.`);
  process.exit(1);
}

console.log(`✅ PASS: Layer 1 within budget.`);
