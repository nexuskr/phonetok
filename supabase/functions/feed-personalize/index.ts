// V17 Edge: feed-personalize
// Builds personalized feed recommendations for the calling user by combining:
//   - their persona / region from `user_feed_profile`
//   - top-scoring videos from `viral_metrics`
//   - their recent feed_events for diversity penalty
// Then upserts the result into `feed_recommendations` so `rank_feed_for_user` RPC
// can serve them client-side. Lovable AI Gemini is used to nudge re-ranking only when
// a suitable model is available — falls back to deterministic ranking otherwise.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

type ViralRow = {
  video_id: string;
  watch_3s_rate: number;
  completion_rate: number;
  share_rate: number;
  viral_score: number;
  region: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "auth_required" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "auth_required" }, 401);
    const uid = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Profile (persona/mode/region)
    const { data: profile } = await admin
      .from("user_feed_profile")
      .select("persona, mode, region")
      .eq("user_id", uid)
      .maybeSingle();
    const mode: string = profile?.mode ?? "general";
    const region: string | null = profile?.region ?? null;

    // 2. Top viral candidates (region-preferred)
    const { data: viralRows } = await admin
      .from("viral_metrics")
      .select("video_id, watch_3s_rate, completion_rate, share_rate, viral_score, region")
      .order("viral_score", { ascending: false })
      .limit(60);
    let candidates: ViralRow[] = (viralRows ?? []) as ViralRow[];
    if (region) {
      candidates = [
        ...candidates.filter((c) => c.region === region),
        ...candidates.filter((c) => c.region !== region),
      ];
    }
    candidates = candidates.slice(0, 30);

    if (candidates.length === 0) {
      return json({ ok: true, written: 0, mode, note: "no_viral_metrics" });
    }

    // 3. Diversity penalty — videos seen in last 24h get small downrank
    const { data: recent } = await admin
      .from("feed_events")
      .select("video_id")
      .eq("user_id", uid)
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(200);
    const seen = new Set((recent ?? []).map((r: { video_id: string }) => r.video_id));

    // 4. Optional Lovable AI re-rank hint (best-effort, non-fatal)
    let aiBoost: Record<string, number> = {};
    if (LOVABLE_AI_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_AI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You re-rank short videos for a Korean trading platform. Reply ONLY as JSON {\"boost\":{\"<video_id>\":<-0.2..0.2>}}. Keep at most 5 keys.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  mode,
                  region,
                  candidates: candidates.slice(0, 12).map((c) => ({
                    id: c.video_id,
                    score: c.viral_score,
                  })),
                }),
              },
            ],
          }),
          signal: AbortSignal.timeout(4000),
        });
        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const txt: string = aiJson?.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(
            (txt.match(/\{[\s\S]*\}/)?.[0] ?? "{}").trim(),
          );
          if (parsed?.boost && typeof parsed.boost === "object") {
            aiBoost = parsed.boost;
          }
        }
      } catch (_) {
        // swallow — AI nudge is optional
      }
    }

    // 5. Final scoring & upsert
    const ranked = candidates
      .map((c) => {
        const base = c.viral_score;
        const seenPenalty = seen.has(c.video_id) ? -0.15 : 0;
        const aiDelta = Math.max(-0.2, Math.min(0.2, aiBoost[c.video_id] ?? 0));
        return { video_id: c.video_id, score: base + seenPenalty + aiDelta };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Replace today's recommendations for this user
    await admin.from("feed_recommendations").delete().eq("user_id", uid);
    const rows = ranked.map((r) => ({
      user_id: uid,
      video_id: r.video_id,
      score: r.score,
      mode,
    }));
    if (rows.length > 0) {
      await admin.from("feed_recommendations").insert(rows);
    }

    return json({ ok: true, written: rows.length, mode, ai: Object.keys(aiBoost).length > 0 });
  } catch (e) {
    console.error("feed-personalize error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
