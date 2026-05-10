// Server-side TP/SL/Trailing-Stop watcher for live_positions.
// Runs on a schedule (cron) — does not require user JWT (uses service-role key).
// For every open position with TP/SL/Trailing set, fetches Bybit prices and
// force-closes via admin_force_close_position when triggers are hit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function isAuthorizedCron(req: Request): boolean {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expected) return false;
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  return timingSafeEqual(token, expected);
}

type Pos = {
  id: string;
  user_id: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  size: number;
  entry: number;
  tp_pct: number | null;
  sl_pct: number | null;
  trailing_pct: number | null;
  trailing_active: boolean;
  trailing_peak_roi_pct: number | null;
};

async function fetchBybitPrices(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const r = await fetch("https://api.bybit.com/v5/market/tickers?category=linear", {
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const list: any[] = j?.result?.list ?? [];
    const set = new Set(symbols);
    for (const t of list) {
      if (set.has(t.symbol)) {
        const p = parseFloat(t.lastPrice ?? t.markPrice ?? "0");
        if (p > 0) out[t.symbol] = p;
      }
    }
  } catch (e) {
    console.error("bybit fetch failed", e);
  }
  return out;
}

function roiPct(p: Pos, mark: number): number {
  if (p.entry <= 0 || p.leverage <= 0) return 0;
  const change = (mark - p.entry) / p.entry;
  return (p.side === "long" ? change : -change) * p.leverage * 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!isAuthorizedCron(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data, error } = await supabase
      .from("live_positions")
      .select("id,user_id,symbol,side,leverage,margin,size,entry,tp_pct,sl_pct,trailing_pct,trailing_active,trailing_peak_roi_pct")
      .eq("status", "open")
      .or("tp_pct.not.is.null,sl_pct.not.is.null,trailing_active.eq.true")
      .limit(2000);
    if (error) throw error;

    const list = (data ?? []) as Pos[];
    if (list.length === 0) {
      return new Response(JSON.stringify({ scanned: 0, closed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const symbols = Array.from(new Set(list.map((p) => p.symbol)));
    const prices = await fetchBybitPrices(symbols);

    let closed = 0;
    let trailingPeakUpdates = 0;
    const errors: string[] = [];

    for (const p of list) {
      const mark = prices[p.symbol];
      if (!mark) continue;
      const roi = roiPct(p, mark);

      // Trailing peak tracking + drawdown check (evaluated FIRST so peak is fresh).
      let trailingHit = false;
      if (p.trailing_active && p.trailing_pct && p.trailing_pct > 0) {
        const peak = p.trailing_peak_roi_pct ?? 0;
        if (roi > peak) {
          const { error: pErr } = await supabase.rpc("admin_update_trailing_peak", {
            p_position_id: p.id,
            p_peak_roi_pct: roi,
          });
          if (pErr) errors.push(`peak ${p.id}: ${pErr.message}`);
          else trailingPeakUpdates++;
        } else if (peak > 0 && roi <= peak - p.trailing_pct) {
          trailingHit = true;
        }
      }

      let reason: "tp" | "sl" | "trailing" | null = null;
      if (trailingHit) reason = "trailing";
      else if (p.tp_pct && p.tp_pct > 0 && roi >= p.tp_pct) reason = "tp";
      else if (p.sl_pct && p.sl_pct > 0 && roi <= -p.sl_pct) reason = "sl";

      if (reason) {
        const { error: rpcErr } = await supabase.rpc("admin_force_close_position", {
          p_position_id: p.id,
          p_mark_price: mark,
          p_reason: reason,
        });
        if (rpcErr) errors.push(`${p.id}/${reason}: ${rpcErr.message}`);
        else closed++;
      }
    }

    return new Response(
      JSON.stringify({
        scanned: list.length,
        closed,
        trailing_peak_updates: trailingPeakUpdates,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
