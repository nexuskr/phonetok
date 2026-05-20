import { useState } from "react";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";

interface Props {
  squadId: string;
  sourceRollId: string;
  gameCode: string;
  amountPhon: number;
  params?: Record<string, unknown>;
}

export function MirrorToggle({ squadId, sourceRollId, gameCode, amountPhon, params }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function mirror() {
    if (busy || done) return;
    setBusy(true);
    try {
      const idem = `mirror:${squadId}:${sourceRollId}`;
      const { data, error } = await supabase.rpc("apex_mirror_bet" as any, {
        _squad_id: squadId,
        _source_roll_id: sourceRollId,
        _game_code: gameCode,
        _amount_phon: amountPhon,
        _params: params ?? {},
        _idem_key: idem,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) { notify.warning(res?.error ?? "미러 실패"); return; }
      setDone(true);
      notify.passive("친구 베팅을 미러했습니다", {
        description: `${amountPhon.toLocaleString()} PHON · ${gameCode}`,
      });
    } catch (e) {
      notify.error("미러 오류", { description: describeError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={mirror} disabled={busy || done}
      className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-bold disabled:opacity-50">
      <Copy className="w-4 h-4" />
      {done ? "MIRRORED" : busy ? "MIRRORING…" : `MIRROR ${amountPhon.toLocaleString()} PHON`}
    </button>
  );
}
