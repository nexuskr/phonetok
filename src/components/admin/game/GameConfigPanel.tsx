/**
 * Game Config Panel — Demo Bias / Near-Miss / Particle Intensity
 * 한 컴포넌트가 mode prop 으로 3 라우트를 모두 처리.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/loading-state";
import { notify } from "@/lib/notify";

type Mode = "bias" | "nearmiss" | "particles";

const TITLES: Record<Mode, string> = {
  bias: "🎮 Demo Bias 슬라이더",
  nearmiss: "🎯 Near-Miss 확률",
  particles: "✨ Crown 파티클 강도",
};

export default function GameConfigPanel({ mode }: { mode: Mode }) {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("game_config").select("*").eq("id", 1).maybeSingle();
    if (error) return notify.error(error.message);
    setCfg(data);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: any) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_game_config" as any, { _patch: patch });
    setBusy(false);
    if (error) return notify.error(error.message);
    notify.success("저장됨");
    load();
  };

  if (!cfg) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl">{TITLES[mode]}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          최종 수정 {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString("ko-KR") : "—"}
        </p>
      </header>

      {mode === "particles" && (
        <ParticleEditor
          value={cfg.crown_particle_intensity}
          busy={busy}
          onSave={(v) => save({ crown_particle_intensity: v })}
        />
      )}

      {mode === "bias" && (
        <JsonKVEditor
          label="Demo Bias (게임별 0~100)"
          value={cfg.demo_bias ?? {}}
          busy={busy}
          onSave={(v) => save({ demo_bias: v })}
        />
      )}

      {mode === "nearmiss" && (
        <JsonKVEditor
          label="Near-Miss 확률 (게임별 0~1)"
          value={cfg.nearmiss_prob ?? {}}
          busy={busy}
          onSave={(v) => save({ nearmiss_prob: v })}
        />
      )}
    </div>
  );
}

function ParticleEditor({ value, busy, onSave }: { value: number; busy: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="glass-strong rounded-2xl p-5 border border-border/40 space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold">강도</span>
        <span className="font-display font-black text-3xl">{v}</span>
      </div>
      <Slider min={0} max={100} step={1} value={[v]} onValueChange={(x) => setV(x[0])} />
      <Button onClick={() => onSave(v)} disabled={busy} className="w-full">저장</Button>
    </div>
  );
}

function JsonKVEditor({
  label,
  value,
  busy,
  onSave,
}: {
  label: string;
  value: Record<string, number>;
  busy: boolean;
  onSave: (v: Record<string, number>) => void;
}) {
  const [pairs, setPairs] = useState<[string, number][]>(() => Object.entries(value));
  const [newKey, setNewKey] = useState("");

  const update = (i: number, k: string, v: number) => {
    const n = [...pairs];
    n[i] = [k, v];
    setPairs(n);
  };
  const remove = (i: number) => setPairs(pairs.filter((_, j) => j !== i));
  const add = () => {
    if (!newKey.trim()) return;
    setPairs([...pairs, [newKey.trim(), 0]]);
    setNewKey("");
  };

  return (
    <div className="glass-strong rounded-2xl p-5 border border-border/40 space-y-3">
      <div className="text-sm font-bold">{label}</div>
      <div className="space-y-2">
        {pairs.map(([k, v], i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={k} onChange={(e) => update(i, e.target.value, v)} className="font-mono flex-1" />
            <Input
              type="number"
              step={0.01}
              value={v}
              onChange={(e) => update(i, k, Number(e.target.value))}
              className="w-32"
            />
            <Button size="sm" variant="ghost" onClick={() => remove(i)}>×</Button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="새 게임 키 (예: slot_aurora)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="font-mono"
          />
          <Button size="sm" variant="outline" onClick={add}>+ 추가</Button>
        </div>
      </div>
      <Button
        onClick={() => onSave(Object.fromEntries(pairs))}
        disabled={busy}
        className="w-full"
      >
        저장
      </Button>
    </div>
  );
}
