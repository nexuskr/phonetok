import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Save } from "lucide-react";
import { notify } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";
import { formatKRW } from "@/lib/store";

type Limits = {
  max_leverage: number;
  max_margin_per_trade: number;
  daily_loss_cap: number;
  enabled: boolean;
};

const DEFAULTS: Limits = {
  max_leverage: 100,
  max_margin_per_trade: 50_000_000,
  daily_loss_cap: 10_000_000,
  enabled: true,
};

export default function RiskLimitsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<Limits>(DEFAULTS);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("user_risk_limits")
        .select("max_leverage,max_margin_per_trade,daily_loss_cap,enabled")
        .maybeSingle();
      if (!alive) return;
      if (data) setV(data as Limits);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("set_user_risk_limits", {
      p_max_leverage: v.max_leverage,
      p_max_margin_per_trade: v.max_margin_per_trade,
      p_daily_loss_cap: v.daily_loss_cap,
      p_enabled: v.enabled,
    } as never);
    setSaving(false);
    if (error) notify.fail("저장 실패", error);
    else notify.success("리스크 한도 저장됨", { description: "다음 진입부터 즉시 적용됩니다." });
  }

  if (loading) return <LoadingList rows={3} />;

  return (
    <section className="glass rounded-2xl p-4 space-y-4">
      <header className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="font-display font-black text-sm">리스크 한도 (Risk Limits)</h3>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={v.enabled}
            onChange={(e) => setV((s) => ({ ...s, enabled: e.target.checked }))}
            className="accent-primary"
          />
          활성화
        </label>
      </header>

      <Field
        label="최대 레버리지"
        suffix="×"
        min={1} max={125} step={1}
        value={v.max_leverage}
        onChange={(n) => setV((s) => ({ ...s, max_leverage: n }))}
      />
      <Field
        label="1회 최대 증거금"
        suffix={formatKRW(v.max_margin_per_trade)}
        min={10000} step={10000}
        value={v.max_margin_per_trade}
        onChange={(n) => setV((s) => ({ ...s, max_margin_per_trade: n }))}
      />
      <Field
        label="일일 최대 손실 한도"
        suffix={formatKRW(v.daily_loss_cap)}
        min={10000} step={10000}
        value={v.daily_loss_cap}
        onChange={(n) => setV((s) => ({ ...s, daily_loss_cap: n }))}
      />

      <button
        onClick={save}
        disabled={saving || !v.enabled && false}
        className="w-full py-3 rounded-xl bg-gradient-gold text-gold-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? "저장 중..." : "한도 저장"}
      </button>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        설정한 한도를 초과하는 진입은 서버에서 즉시 차단됩니다. 일일 손실 한도는 청산·손절·수동청산의 누적 손실(KRW)을 기준으로 합니다.
      </p>
    </section>
  );
}

function Field({
  label, value, onChange, suffix, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="font-bold">{label}</span>
        <span className="text-muted-foreground tabular-nums">{suffix}</span>
      </div>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
        className="w-full bg-input/60 border border-border/60 rounded-xl px-3 py-2 text-sm tabular-nums"
      />
    </label>
  );
}
