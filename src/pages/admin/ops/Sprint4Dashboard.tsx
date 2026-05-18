/**
 * Sprint 4 — Admin ops dashboard for client-side telemetry.
 * Polls `imperial-lobby-analytics` every 15s. AAL2 gated by parent admin layout.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading-state";

interface MetricSummary { p50: number; p75: number; p95: number; avg: number; min: number; n: number }
interface AnalyticsPayload {
  window_hours: number;
  generated_at: string;
  metrics?: Record<string, MetricSummary>;
  haptic?: { ok: number; fail: number; rate: number | null };
  swipe?:  { ok: number; fail: number; rate: number | null };
  device_tiers?: Record<string, number>;
}

export default function Sprint4Dashboard() {
  const [windowH, setWindowH] = useState<24 | 48>(24);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const { data: res, error } = await supabase.functions.invoke("imperial-lobby-analytics", {
        body: undefined,
        method: "GET" as never,
      } as { body: undefined; method: "GET" }).catch(async () => {
        // fallback: query string variant
        const sess = await supabase.auth.getSession();
        const tok = sess.data.session?.access_token;
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/imperial-lobby-analytics?window_hours=${windowH}`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        return { data: await r.json(), error: r.ok ? null : { message: `http_${r.status}` } };
      });
      if (error) throw new Error(error.message);
      setData(res as AnalyticsPayload);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message ?? "load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowH]);

  if (loading && !data) return <LoadingList rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Sprint 4 · Lobby Telemetry</h2>
        <div className="ml-auto flex gap-1">
          {[24, 48].map((h) => (
            <Button key={h} size="sm" variant={windowH === h ? "default" : "outline"}
                    onClick={() => setWindowH(h as 24 | 48)}>{h}h</Button>
          ))}
        </div>
      </div>

      {err && (
        <Card className="p-3 border-destructive/40 text-sm text-destructive">
          load error: {err}
        </Card>
      )}

      {(!data || (!data.metrics && !data.haptic?.ok && !data.swipe?.ok)) ? (
        <EmptyState title="아직 수집된 데이터가 없습니다"
                    description="사용자가 /duel 로비를 사용하면 15초 폴링으로 채워집니다." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-2">Web Vitals + FPS (route=/duel)</div>
            <table className="w-full text-sm">
              <thead><tr className="text-muted-foreground">
                <th className="text-left">metric</th><th>p50</th><th>p75</th><th>p95</th><th>avg</th><th>n</th>
              </tr></thead>
              <tbody>
                {Object.entries(data.metrics ?? {}).map(([k, v]) => (
                  <tr key={k} className="border-t border-border/40">
                    <td className="py-1 font-mono">{k}</td>
                    <td className="text-right">{v.p50}</td>
                    <td className="text-right">{v.p75}</td>
                    <td className="text-right">{v.p95}</td>
                    <td className="text-right">{v.avg}</td>
                    <td className="text-right text-muted-foreground">{v.n}</td>
                  </tr>
                ))}
                {!data.metrics && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-2">no samples yet</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card className="p-4 space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Haptic success</div>
              <div className="text-2xl font-semibold">
                {data.haptic?.rate ?? "—"}<span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                ok {data.haptic?.ok ?? 0} · fail {data.haptic?.fail ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Swipe success</div>
              <div className="text-2xl font-semibold">
                {data.swipe?.rate ?? "—"}<span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                ok {data.swipe?.ok ?? 0} · fail {data.swipe?.fail ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Device tier distribution</div>
              <div className="flex flex-wrap gap-1 text-xs">
                {Object.entries(data.device_tiers ?? {}).map(([t, n]) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-muted">{t}: {n}</span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        generated_at: {data?.generated_at ?? "—"} · window: {data?.window_hours ?? windowH}h · poll 15s
      </div>
    </div>
  );
}
