import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import CountUp from "@/components/feedback/CountUp";
import { notify } from "@/lib/notify";
import { useBalance } from "@/hooks/use-profile";

const SYMS = [
  { code: "BTCUSDT", label: "BTC" },
  { code: "ETHUSDT", label: "ETH" },
  { code: "SOLUSDT", label: "SOL" },
];

export default function Trade() {
  const { data: balance = 0 } = useBalance();
  const [sym, setSym] = useState(SYMS[0]);
  const [price, setPrice] = useState<number | null>(null);
  const [amount, setAmount] = useState(10000);
  const [lev, setLev] = useState(10);
  const [position, setPosition] = useState<{ side: "LONG"|"SHORT"; entry: number; amount: number; lev: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym.code}`);
        const j = await r.json();
        const p = Number(j?.result?.list?.[0]?.lastPrice);
        if (alive && p > 0) setPrice(p);
      } catch { /* */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [sym]);

  const open = (side: "LONG" | "SHORT") => {
    if (!price) return notify.warn("가격 로딩 중");
    if (amount > balance) return notify.error("잔액 부족", "PHON 충전 또는 출석으로 잔액을 늘리세요");
    setPosition({ side, entry: price, amount, lev });
    notify.success(`${side} 포지션 진입`, `${sym.label} @ $${price.toLocaleString()}`);
  };

  const close = () => {
    if (!position || !price) return;
    const diff = (price - position.entry) / position.entry * (position.side === "LONG" ? 1 : -1);
    const pnl = Math.round(position.amount * diff * position.lev);
    notify[ pnl >= 0 ? "success" : "info"](`PnL ${pnl >= 0 ? "+" : ""}${pnl.toLocaleString()} PHON`, "시뮬레이션 청산");
    setPosition(null);
  };

  const pnl = position && price
    ? Math.round(position.amount * ((price - position.entry) / position.entry) * (position.side === "LONG" ? 1 : -1) * position.lev)
    : 0;

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">트레이드</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-secondary/20 text-secondary font-bold">SIM</span>
      </header>

      <div className="flex gap-2">
        {SYMS.map((s) => (
          <button key={s.code} onClick={() => setSym(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${sym.code === s.code ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 bg-card border border-border"
      >
        <div className="text-xs text-muted-foreground">{sym.label}/USDT 시세</div>
        <div className="text-4xl font-black mt-1">
          ${price ? <CountUp value={Math.round(price)} /> : "—"}
        </div>
        {position && (
          <div className="mt-3 text-sm">
            <span className={position.side === "LONG" ? "text-green-400" : "text-destructive"}>{position.side}</span>{" "}
            진입 ${position.entry.toLocaleString()} · {position.lev}x ·{" "}
            <span className={`font-bold ${pnl >= 0 ? "text-green-400" : "text-destructive"}`}>
              {pnl >= 0 ? "+" : ""}{pnl.toLocaleString()} PHON
            </span>
          </div>
        )}
      </motion.section>

      <section className="rounded-2xl p-4 bg-card border border-border space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>주문 금액</span>
          <span>잔액 {balance.toLocaleString()} PHON</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1000, 10000, 50000, 100000].map((v) => (
            <button key={v} onClick={() => setAmount(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${amount === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {v.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>레버리지</span><span className="text-primary font-bold">{lev}x</span>
          </div>
          <input type="range" min={1} max={100} value={lev} onChange={(e) => setLev(Number(e.target.value))}
            className="w-full accent-primary" />
        </div>
      </section>

      {position ? (
        <button onClick={close}
          className="w-full py-4 rounded-2xl bg-foreground text-background font-black text-lg active:scale-[0.98] transition">
          포지션 청산 {pnl !== 0 && `(${pnl >= 0 ? "+" : ""}${pnl.toLocaleString()})`}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => open("LONG")}
            className="py-5 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition">
            <TrendingUp className="h-5 w-5" /> LONG
          </button>
          <button onClick={() => open("SHORT")}
            className="py-5 rounded-2xl bg-gradient-to-br from-destructive to-red-700 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition">
            <TrendingDown className="h-5 w-5" /> SHORT
          </button>
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Zap className="h-3 w-3" /> 시뮬레이션 모드 · 실거래 곧 오픈
      </div>
    </main>
  );
}
