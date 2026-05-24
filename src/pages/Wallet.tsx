import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon } from "lucide-react";

export default function Wallet() {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">내 지갑</h1>
      </header>

      <section className="rounded-2xl bg-gradient-to-br from-primary/15 to-card border border-primary/20 p-6">
        <div className="text-sm text-muted-foreground">총 잔액</div>
        <div className="text-4xl font-black mt-1">0 <span className="text-lg text-primary">PHON</span></div>
        <div className="text-xs text-muted-foreground mt-1">≈ ₩0</div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button className="flex flex-col items-center gap-2 py-4 rounded-xl bg-card border border-border hover:border-primary transition">
          <ArrowDownToLine className="h-6 w-6 text-primary" />
          <span className="font-bold">입금</span>
        </button>
        <button className="flex flex-col items-center gap-2 py-4 rounded-xl bg-card border border-border hover:border-primary transition">
          <ArrowUpFromLine className="h-6 w-6 text-primary" />
          <span className="font-bold">출금</span>
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">최근 내역</h2>
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          아직 거래 내역이 없습니다
        </div>
      </section>
    </main>
  );
}
