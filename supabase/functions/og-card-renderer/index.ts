// og-card-renderer: dynamic SVG OG image for Phonara Empire share cards
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "jsr:@supabase/supabase-js@2";

function esc(s: string) {
  return s.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid") ?? "";
  const guildId = url.searchParams.get("guild") ?? "";

  let title = "Phonara Empire";
  let subtitle = "폰 하나로 제국을 쌓는다";
  let stat1Label = "오늘의 영토";
  let stat1Value = "7";
  let stat2Label = "전투력";
  let stat2Value = "0";
  let emblem = "🏰";

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (guildId) {
      const { data: g } = await admin
        .from("guilds")
        .select("name, emblem, total_power, member_count")
        .eq("id", guildId)
        .maybeSingle();
      if (g) {
        title = (g as any).name;
        emblem = (g as any).emblem ?? "🏰";
        subtitle = `길드원 ${(g as any).member_count}명 · 전투력 ${(g as any).total_power}`;
        stat1Label = "총 전투력";
        stat1Value = Number((g as any).total_power).toLocaleString();
        stat2Label = "길드원";
        stat2Value = String((g as any).member_count);
      }
    } else if (userId) {
      const { data: p } = await admin
        .from("profiles")
        .select("display_name, total_earnings, tier")
        .eq("user_id", userId)
        .maybeSingle();
      if (p) {
        title = (p as any).display_name ?? "황제";
        subtitle = `${(p as any).tier ?? "Bronze"} 등급의 제국 군주`;
        stat1Label = "누적 수익";
        stat1Value = Number((p as any).total_earnings ?? 0).toLocaleString() + "원";
        const { count } = await admin
          .from("empire_battles")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        stat2Label = "전투 수";
        stat2Value = String(count ?? 0);
      }
    }
  } catch (_e) {
    /* ignore — fall back to defaults */
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0a0a0f"/>
        <stop offset="1" stop-color="#1a1408"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fbbf24"/>
        <stop offset="1" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1050" cy="120" r="200" fill="#fbbf24" opacity="0.08"/>
    <circle cx="120" cy="540" r="160" fill="#f59e0b" opacity="0.06"/>
    <text x="80" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="36" fill="url(#gold)" font-weight="700">PHONARA · EMPIRE</text>
    <text x="80" y="160" font-family="system-ui, sans-serif" font-size="22" fill="#9ca3af">${esc(subtitle)}</text>
    <text x="80" y="320" font-family="system-ui, sans-serif" font-size="120" font-weight="800" fill="#fafafa">${esc(emblem + " " + title.slice(0, 14))}</text>
    <g transform="translate(80,400)">
      <rect width="480" height="140" rx="20" fill="#0f0f15" stroke="#fbbf24" stroke-opacity="0.3" stroke-width="2"/>
      <text x="30" y="50" font-family="system-ui" font-size="20" fill="#9ca3af">${esc(stat1Label)}</text>
      <text x="30" y="110" font-family="system-ui" font-size="56" font-weight="800" fill="url(#gold)">${esc(stat1Value)}</text>
    </g>
    <g transform="translate(600,400)">
      <rect width="520" height="140" rx="20" fill="#0f0f15" stroke="#fbbf24" stroke-opacity="0.3" stroke-width="2"/>
      <text x="30" y="50" font-family="system-ui" font-size="20" fill="#9ca3af">${esc(stat2Label)}</text>
      <text x="30" y="110" font-family="system-ui" font-size="56" font-weight="800" fill="#fafafa">${esc(stat2Value)}</text>
    </g>
    <text x="80" y="600" font-family="system-ui" font-size="18" fill="#6b7280">phonara.world · 폰 하나로 제국을 쌓는다</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
    status: 200,
  });
});
