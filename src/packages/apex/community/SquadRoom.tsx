import { useEffect, useState } from "react";
import { Crown, Copy as CopyIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { SquadCreatePanel } from "./SquadCreatePanel";
import { MirrorToggle } from "./MirrorToggle";
import { useApexSquadChannel } from "./hooks/useSquadChannel";

interface Squad {
  id: string;
  host_user_id: string;
  member_ids: string[];
  status: "open" | "locked" | "done";
  current_bet_mirror: {
    roll_id?: string; game_code?: string; amount_phon?: number; params?: any;
  } | null;
}

export default function SquadRoom() {
  const [me, setMe] = useState("");
  const [squad, setSquad] = useState<Squad | null>(null);
  const [mirrorCount, setMirrorCount] = useState(0);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data?.user?.id ?? "")); }, []);

  async function load(id: string) {
    const { data } = await supabase
      .from("apex_squad_rooms" as any)
      .select("id,host_user_id,member_ids,status,current_bet_mirror")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const row = data as any;
      const members = Array.isArray(row.member_ids) ? (row.member_ids as string[]) : [];
      setSquad({ ...row, member_ids: members });
    }
    const { count } = await supabase
      .from("apex_squad_mirrors" as any)
      .select("id", { count: "exact", head: true })
      .eq("squad_id", id);
    setMirrorCount(count ?? 0);
  }

  useApexSquadChannel(squad?.id ?? "", (kind) => {
    if (squad?.id) load(squad.id);
    if (kind === "mirror") notify.passive("스쿼드 멤버가 미러했습니다");
  });

  if (!squad) return <div className="p-4"><SquadCreatePanel onCreated={load} /></div>;

  const isHost = squad.host_user_id === me;
  const slots = [0, 1, 2].map((i) => squad.member_ids[i] ?? null);

  function copyId() {
    navigator.clipboard?.writeText(squad!.id);
    notify.passive("스쿼드 ID 복사 완료");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-border bg-card/50">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">SQUAD ROOM</h2>
            <button onClick={copyId}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
              <CopyIcon className="w-3 h-3" /> ID 복사
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((uid, i) => (
              <div key={i} className={`rounded-lg border p-3 text-center text-[10px] ${
                uid ? "border-primary/50 bg-primary/10" : "border-dashed border-border text-muted-foreground"
              }`}>
                {uid ? (
                  <div className="flex flex-col items-center gap-1">
                    {uid === squad.host_user_id && <Crown className="w-3 h-3" />}
                    <span className="font-mono">{uid.slice(0, 8)}</span>
                  </div>
                ) : "EMPTY"}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            상태 · <span className="text-primary">{squad.status}</span> · 미러 {mirrorCount}건
          </div>
        </div>
      </div>

      {squad.current_bet_mirror?.roll_id && squad.current_bet_mirror.game_code ? (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">호스트 베팅</div>
          <div className="font-bold">{squad.current_bet_mirror.game_code.toUpperCase()} · {(squad.current_bet_mirror.amount_phon ?? 0).toLocaleString()} PHON</div>
          <MirrorToggle
            squadId={squad.id}
            sourceRollId={squad.current_bet_mirror.roll_id}
            gameCode={squad.current_bet_mirror.game_code}
            amountPhon={Number(squad.current_bet_mirror.amount_phon ?? 0)}
            params={squad.current_bet_mirror.params}
          />
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground p-4 border border-dashed border-border rounded-lg">
          {isHost ? "베팅을 시작하면 멤버가 미러할 수 있습니다" : "호스트가 베팅을 시작하길 기다리는 중…"}
        </div>
      )}
    </div>
  );
}
