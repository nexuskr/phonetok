import { Link } from "react-router-dom";
import { Gift, LineChart, Gem, Users, Wallet as WalletIcon, Flame } from "lucide-react";

const TILES = [
  { to: "/wallet", icon: WalletIcon, title: "내 지갑", desc: "잔액 확인 / 출금" },
  { to: "/trade", icon: LineChart, title: "트레이드", desc: "BTC · ETH 예측" },
  { to: "/slots", icon: Gem, title: "슬롯 게임", desc: "Olympus 1000" },
  { to: "/refer", icon: Users, title: "친구 추천", desc: "초대하고 보상받기" },
];

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-6 space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-primary/20 via-card to-card border border-primary/20 p-6">
        <div className="flex items-center gap-2 text-primary text-sm font-bold">
          <Flame className="h-4 w-4" /> 오늘의 무료 보너스
        </div>
        <h1 className="text-2xl font-black mt-2">출석만 해도 매일 PHON 지급</h1>
        <p className="text-sm text-muted-foreground mt-1">3초 안에 첫 보상을 받아보세요.</p>
        <button className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          <Gift className="h-4 w-4" /> 출석 보너스 받기
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {TILES.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="rounded-2xl bg-card border border-border p-4 hover:border-primary transition-colors"
          >
            <Icon className="h-6 w-6 text-primary" />
            <div className="mt-3 font-bold">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
