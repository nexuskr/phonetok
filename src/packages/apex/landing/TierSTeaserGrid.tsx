// Tier S teaser — 5 cards linking to each game.
import { Link } from "react-router-dom";

const TIERS = [
  { slug: "pump", name: "Pump", tag: "x∞ 펌프 게임", color: "from-pink-500/30 to-rose-500/10" },
  { slug: "wheel", name: "Wheel", tag: "운명의 휠", color: "from-amber-500/30 to-yellow-500/10" },
  { slug: "limbo", name: "Limbo", tag: "한 방의 멀티", color: "from-emerald-500/30 to-teal-500/10" },
  { slug: "keno", name: "Keno", tag: "10/40 숫자 베팅", color: "from-cyan-500/30 to-blue-500/10" },
  { slug: "hilo", name: "HiLo", tag: "Higher / Lower", color: "from-purple-500/30 to-fuchsia-500/10" },
];

export default function TierSTeaserGrid() {
  return (
    <section aria-label="Tier S 게임" className="mx-auto mt-10 max-w-6xl px-2">
      <h2 className="mb-4 text-xl font-bold">Tier S — 끝판왕 5종</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TIERS.map((t) => (
          <Link
            key={t.slug}
            to={`/apex/games/${t.slug}`}
            className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${t.color} p-5 transition-transform hover:scale-[1.03]`}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Tier S</p>
            <p className="mt-1 text-2xl font-black text-foreground">{t.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.tag}</p>
            <p className="mt-3 text-xs text-primary">🔒 Verified by Drand</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
