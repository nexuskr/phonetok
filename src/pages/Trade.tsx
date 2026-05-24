import { LineChart, TrendingUp, TrendingDown } from "lucide-react";

export default function Trade() {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <LineChart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">실시간 트레이드</h1>
      </header>

      <section className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm text-muted-foreground">BTC/USDT</div>
            <div className="text-3xl font-black">$67,420</div>
          </div>
          <div className="text-emerald-500 font-bold">+1.24%</div>
        </div>
        <div className="aspect-video rounded-lg bg-muted/30 border border-border flex items-center justify-center text-muted-foreground text-sm">
          차트 준비 중
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-500/90 text-white font-bold">
          <TrendingUp className="h-5 w-5" /> 상승 (LONG)
        </button>
        <button className="flex items-center justify-center gap-2 py-4 rounded-xl bg-rose-500/90 text-white font-bold">
          <TrendingDown className="h-5 w-5" /> 하락 (SHORT)
        </button>
      </div>
    </main>
  );
}
