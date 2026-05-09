import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, RefreshCw, AlertTriangle, History, ScrollText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Sub = "perms" | "drift" | "audit";

type PermRow = {
  function_name: string;
  function_args: string;
  category: "admin_only" | "system_only" | "user_callable" | string;
  expected_roles: string[];
  observed_roles: string[];
  in_drift: boolean;
  note: string | null;
};

type DriftRow = {
  id: string;
  detected_at: string;
  function_name: string;
  function_args: string;
  expected_roles: string[];
  observed_roles: string[];
  change_type: string;
  metadata: any;
};

type AuditRow = {
  id: string;
  created_at: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: any;
};

const CAT_TONE: Record<string, string> = {
  admin_only: "text-destructive",
  system_only: "text-secondary",
  user_callable: "text-primary",
};

export default function PermissionsAudit() {
  const [sub, setSub] = useState<Sub>("perms");
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [drifts, setDrifts] = useState<DriftRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "admin_only" | "system_only" | "user_callable" | "drift">("all");

  async function load() {
    setLoading(true);
    try {
      const [p, d, a] = await Promise.allSettled([
        supabase.rpc("get_function_permissions_overview" as any),
        supabase.rpc("get_permission_change_log" as any, { _limit: 200 }),
        supabase.rpc("get_admin_audit_recent" as any, { _limit: 200 }),
      ]);
      if (p.status === "fulfilled" && !p.value.error) setPerms((p.value.data ?? []) as PermRow[]);
      if (d.status === "fulfilled" && !d.value.error) setDrifts((d.value.data ?? []) as DriftRow[]);
      if (a.status === "fulfilled" && !a.value.error) setAudits((a.value.data ?? []) as AuditRow[]);
    } catch (e: any) {
      toast({ title: "조회 실패", description: e?.message ?? "" });
    } finally {
      setLoading(false);
    }
  }

  async function runDriftCheck() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("check_permission_drift" as any);
      if (error) throw error;
      const r: any = data;
      toast({
        title: r?.ok ? "드리프트 없음 ✅" : `드리프트 ${r?.drift_count}건 감지 ⚠️`,
        description: r?.ok ? "모든 함수 권한이 베이스라인과 일치합니다." : "권한 변경 이력에 기록되었습니다.",
      });
      await load();
    } catch (e: any) {
      toast({ title: "검사 실패", description: e?.message ?? "" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin:permission_drift")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "permission_change_log" }, (payload: any) => {
        toast({
          title: "🚨 권한 변경 감지",
          description: `${payload.new?.function_name} (${payload.new?.change_type})`,
        });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredPerms = useMemo(() => {
    if (filter === "all") return perms;
    if (filter === "drift") return perms.filter((p) => p.in_drift);
    return perms.filter((p) => p.category === filter);
  }, [perms, filter]);

  const driftCount = perms.filter((p) => p.in_drift).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <h2 className="font-display font-black text-lg">권한 감사</h2>
          {driftCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive font-bold">
              드리프트 {driftCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={runDriftCheck}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> 드리프트 검사
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 새로고침
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/40">
        {([
          { id: "perms", label: "함수 권한", icon: ShieldCheck },
          { id: "drift", label: "변경 이력", icon: History },
          { id: "audit", label: "관리자 작업", icon: ScrollText },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`text-xs px-3 py-2 inline-flex items-center gap-1.5 border-b-2 ${
              sub === t.id ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {sub === "perms" && (
        <>
          <div className="flex gap-1 flex-wrap">
            {(["all", "drift", "admin_only", "system_only", "user_callable"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2 py-1 rounded ${
                  filter === f ? "bg-gold text-background font-bold" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "전체" : f === "drift" ? `드리프트 ${driftCount}` : f}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">함수</th>
                  <th className="text-left px-3 py-2 font-bold">분류</th>
                  <th className="text-left px-3 py-2 font-bold">기대 권한</th>
                  <th className="text-left px-3 py-2 font-bold">현재 권한</th>
                  <th className="text-left px-3 py-2 font-bold">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerms.map((p) => (
                  <tr key={`${p.function_name}:${p.function_args}`} className="border-t border-border/30">
                    <td className="px-3 py-2 font-mono">
                      <div className="font-bold">{p.function_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[280px]">{p.function_args || "(no args)"}</div>
                    </td>
                    <td className={`px-3 py-2 font-bold ${CAT_TONE[p.category] ?? ""}`}>{p.category}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {p.expected_roles.length ? p.expected_roles.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {p.observed_roles.length ? p.observed_roles.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {p.in_drift ? (
                        <span className="text-destructive font-bold">⚠ DRIFT</span>
                      ) : (
                        <span className="text-primary">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPerms.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-xs">표시할 항목이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "drift" && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 font-bold">시각</th>
                <th className="text-left px-3 py-2 font-bold">함수</th>
                <th className="text-left px-3 py-2 font-bold">기대 → 관측</th>
                <th className="text-left px-3 py-2 font-bold">유형</th>
              </tr>
            </thead>
            <tbody>
              {drifts.map((d) => (
                <tr key={d.id} className="border-t border-border/30">
                  <td className="px-3 py-2 text-muted-foreground">{new Date(d.detected_at).toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 font-mono font-bold">{d.function_name}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {(d.expected_roles ?? []).join(",") || "—"} <span className="text-destructive">→</span> {(d.observed_roles ?? []).join(",") || "—"}
                  </td>
                  <td className="px-3 py-2 text-destructive font-bold">{d.change_type}</td>
                </tr>
              ))}
              {drifts.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">변경 이력 없음.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sub === "audit" && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 font-bold">시각</th>
                <th className="text-left px-3 py-2 font-bold">관리자</th>
                <th className="text-left px-3 py-2 font-bold">작업</th>
                <th className="text-left px-3 py-2 font-bold">대상</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} className="border-t border-border/30">
                  <td className="px-3 py-2 text-muted-foreground">{new Date(a.created_at).toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{a.admin_id?.slice(0, 8)}…</td>
                  <td className="px-3 py-2 font-bold">{a.action}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{a.target_type ?? "—"} {a.target_id?.slice(0, 8) ?? ""}</td>
                </tr>
              ))}
              {audits.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">관리자 작업 이력 없음.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
