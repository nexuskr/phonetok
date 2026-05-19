import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Package, Sparkles } from "lucide-react";

const TIERS = [
  { code: "basic",    label: "Basic",    cost: 100,    color: "border-primary/40",  glow: "" },
  { code: "premium",  label: "Premium",  cost: 1000,   color: "border-secondary/60", glow: "apex-glow-neon" },
  { code: "ultimate", label: "Ultimate", cost: 10000,  color: "border-accent/70",    glow: "apex-glow-magenta" },
];

export default function ApexLootbox() {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<any>(null);

  async function open(tier: string) {
    setBusy(tier);
    setLast(null);
    const { data, error } = await supabase.rpc("open_mock_lootbox" as any, { _tier: tier });
    setBusy(null);
    if (error) {
      notify.error(error.message ?? "오픈 실패 — 잔액 부족?");
      return;
    }
    setLast(data);
    notify.success(`${String((data as any)?.rarity).toUpperCase()} · +${(data as any)?.reward_phon} PHON`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-black apex-gradient-text">NFT Lootbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          현재는 mock 보상 (in-game PHON). 향후 Solana cNFT (Bubblegum V2) 마이그레이션은
          <a href="/MIGRATION.md" className="text-primary underline ml-1">MIGRATION.md</a> 참고.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <div
            key={t.code}
            className={`apex-glass rounded-3xl p-6 border-2 ${t.color} ${t.glow} hover:scale-[1.02] transition`}
          >
            <div className="relative">
              <Package className="w-16 h-16 text-primary" />
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-accent apex-pulse" />
            </div>
            <p className="mt-3 text-2xl font-black">{t.label}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              비용 {t.cost.toLocaleString()} PHON
            </p>
            <button
              disabled={busy === t.code}
              onClick={() => open(t.code)}
              className="mt-5 w-full py-3 rounded-xl apex-gradient text-background font-black"
            >
              {busy === t.code ? "오픈 중…" : "오픈"}
            </button>
          </div>
        ))}
      </div>

      {last && (
        <div className="apex-glass rounded-2xl p-6 text-center animate-fade-in apex-glow-neon">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">최근 오픈</p>
          <p className="mt-2 text-4xl font-black apex-text-neon">
            {String((last as any).rarity).toUpperCase()}
          </p>
          <p className="mt-1 text-2xl apex-text-magenta font-black tabular-nums">
            +{(last as any).reward_phon?.toLocaleString()} PHON
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        FUTURE: Bubblegum V2 cNFT mint on Solana · Arweave metadata · Helius DAS indexing.
      </p>
    </div>
  );
}
