import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon } from "lucide-react";
import CountUp from "@/components/feedback/CountUp";
import { useBalance } from "@/hooks/use-profile";
import { fmtKRW } from "@/lib/format";
import { notify } from "@/lib/notify";

export default function Wallet() {
  const { data: balance = 0 } = useBalance();

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      <header className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">내 지갑</h1>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 bg-[image:var(--gradient-imperial)] shadow-[var(--glow-gold)] text-primary-foreground"
      >
        <div className="text-xs font-bold opacity-80">총 잔액</div>
        <div className="text-5xl font-black mt-1 flex items-baseline gap-2">
          <CountUp value={balance} /> <span className="text-xl">PHON</span>
        </div>
        <div className="text-sm opacity-80 mt-1">≈ {fmtKRW(balance)}</div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => notify.info("입금 곧 오픈", "코인·은행 입금 베타 준비 중")}
          className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-card border border-border hover:border-primary/40 active:scale-95 transition"
        >
          <ArrowDownToLine className="h-7 w-7 text-primary" />
          <span className="font-bold">입금</span>
        </button>
        <button
          onClick={() => notify.info("출금 곧 오픈", "최소 출금 50,000 PHON")}
          className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-card border border-border hover:border-primary/40 active:scale-95 transition"
        >
          <ArrowUpFromLine className="h-7 w-7 text-primary" />
          <span className="font-bold">출금</span>
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold px-1">최근 내역</h2>
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          아직 거래 내역이 없습니다.
        </div>
      </section>
    </main>
  );
}
