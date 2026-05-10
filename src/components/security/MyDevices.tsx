import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Smartphone, Trash2, ShieldCheck, Clock } from "lucide-react";
import { getFingerprint } from "@/lib/deviceFingerprint";

type Device = {
  id: string;
  fp_hash: string;
  ua: string | null;
  first_seen: string;
  last_seen: string;
  trusted: boolean;
};

function shortUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  const m = ua.match(/(iPhone|iPad|Android|Macintosh|Windows|Linux)/);
  const browser = ua.match(/(Chrome|Safari|Firefox|Edge|OPR)\/[\d.]+/);
  return [m?.[0] ?? "Device", browser?.[1] ?? ""].filter(Boolean).join(" · ");
}

export default function MyDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFp, setCurrentFp] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const fp = await getFingerprint().catch(() => "");
    setCurrentFp(fp);
    const { data, error } = await supabase
      .from("user_devices" as any)
      .select("id, fp_hash, ua, first_seen, last_seen, trusted")
      .order("last_seen", { ascending: false });
    if (error) {
      notify.fail("디바이스 불러오기 실패", error);
      setLoading(false);
      return;
    }
    setDevices((data ?? []) as unknown as Device[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const onTrust = async (d: Device) => {
    const { error } = await supabase
      .from("user_devices" as any)
      .update({ trusted: !d.trusted })
      .eq("id", d.id);
    if (error) return notify.fail("변경 실패", error);
    notify.success(d.trusted ? "신뢰 해제됨" : "신뢰 디바이스로 표시");
    void load();
  };

  const onRemove = async (d: Device) => {
    if (d.fp_hash === currentFp) {
      notify.warning("현재 사용 중인 디바이스는 제거할 수 없습니다");
      return;
    }
    if (!confirm("이 디바이스를 제거하시겠습니까? 다음 접속 시 새 디바이스로 인식됩니다.")) return;
    const { error } = await supabase.from("user_devices" as any).delete().eq("id", d.id);
    if (error) return notify.fail("제거 실패", error);
    notify.success("디바이스가 제거되었습니다");
    void load();
  };

  if (loading) return <LoadingList rows={2} />;

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={<Smartphone className="w-8 h-8" />}
        title="등록된 디바이스가 없습니다"
        description="다음 로그인 시 자동 등록됩니다."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-2">
      {devices.map((d) => {
        const isCurrent = d.fp_hash === currentFp;
        return (
          <div
            key={d.id}
            className={`glass-strong rounded-2xl p-4 flex items-center gap-3 ${
              isCurrent ? "border border-primary/40" : "border border-border/40"
            }`}
          >
            <div className={`p-2 rounded-xl ${d.trusted ? "bg-success/10" : "bg-muted/30"}`}>
              {d.trusted ? (
                <ShieldCheck className="w-5 h-5 text-success" />
              ) : (
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-bold text-sm truncate">{shortUA(d.ua)}</div>
                {isCurrent && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-black tracking-wider">
                    THIS DEVICE
                  </span>
                )}
                {d.trusted && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-black tracking-wider">
                    TRUSTED
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />
                최근 {new Date(d.last_seen).toLocaleString("ko-KR")}
              </div>
              <div className="text-[10px] text-muted-foreground/60 font-mono">
                #{d.fp_hash.slice(0, 12)}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => onTrust(d)}
                className="text-[10px] px-2 py-1 rounded-lg bg-muted/40 hover:bg-muted font-bold transition"
              >
                {d.trusted ? "해제" : "신뢰"}
              </button>
              {!isCurrent && (
                <button
                  onClick={() => onRemove(d)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold transition inline-flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 제거
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
