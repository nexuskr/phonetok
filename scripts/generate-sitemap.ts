// Generates public/sitemap.xml from a static entry list. Runs via predev/prebuild.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://phonara.world";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const today = new Date().toISOString().slice(0, 10);

const entries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0", lastmod: today },
  { path: "/safe", changefreq: "weekly", priority: "0.9", lastmod: today },
  { path: "/apex", changefreq: "daily", priority: "0.9", lastmod: today },
  { path: "/apex/games", changefreq: "daily", priority: "0.8", lastmod: today },
  { path: "/apex/games/pump", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/games/wheel", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/games/limbo", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/games/keno", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/games/hilo", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/games/crash-v2", changefreq: "weekly", priority: "0.7" },
  { path: "/apex/race", changefreq: "daily", priority: "0.7" },
  { path: "/trust", changefreq: "weekly", priority: "0.6" },
  { path: "/fairness", changefreq: "weekly", priority: "0.6" },
];

function generate(): string {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generate());
console.log(`[sitemap] wrote ${entries.length} entries → public/sitemap.xml`);
