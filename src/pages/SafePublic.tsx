// /safe — Meta-safe, SEO-first public page. Minimal JS, full Helmet head, JSON-LD.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const FAQ = [
  { q: "ApexForge는 무엇인가요?", a: "ApexForge는 Provably-Fair 검증과 즉시 정산을 지원하는 차세대 베팅·게이밍 플랫폼입니다." },
  { q: "공정성은 어떻게 보장되나요?", a: "Drand 분산 무작위성과 Ed25519 서버 서명, 클라이언트 시드를 결합한 3중 하이브리드 VRF v2.5 를 사용합니다." },
  { q: "출금은 얼마나 걸리나요?", a: "최근 30일 출금 p95 는 6분 이내이며, Cross-Chain Cashout 으로 다양한 자산으로 즉시 수령할 수 있습니다." },
  { q: "어떤 게임이 있나요?", a: "Tier S 5종(Pump · Wheel · Limbo · Keno · HiLo), Live Crash V2, Sportsbook 을 제공합니다." },
];

export default function SafePublic() {
  const url = "https://phonara.world/safe";
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ApexForge",
    url,
    description: "Provably-Fair betting platform with Drand-verified randomness and 6-minute cashouts.",
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl bg-background px-4 py-12 text-foreground">
      <Helmet>
        <title>ApexForge — Provably-Fair Betting Platform</title>
        <meta
          name="description"
          content="ApexForge는 Drand 검증 VRF와 6분 이내 출금을 지원하는 차세대 베팅 플랫폼입니다. Tier S 5종 + Live Crash V2."
        />
        <link rel="canonical" href={url} />
        <meta property="og:title" content="ApexForge — Provably-Fair Betting Platform" />
        <meta property="og:description" content="Drand-verified randomness. 6-minute cashouts. Tier S × 5." />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(ld)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      <h1 className="text-4xl font-black">ApexForge</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Provably-Fair 베팅 플랫폼. Drand 분산 무작위성으로 검증된 결과, 6분 이내 출금.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">무엇을 제공하나요?</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-foreground/90">
          <li>Tier S 게임 5종 (Pump · Wheel · Limbo · Keno · HiLo)</li>
          <li>Live Crash V2 — 라이브 멀티플레이 크래시</li>
          <li>Sportsbook · 라이브 베팅</li>
          <li>Race · Rakeback · 토너먼트</li>
          <li>Cross-Chain Cashout</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">공정성 (VRF v2.5)</h2>
        <p className="mt-3 text-foreground/90">
          각 라운드의 결과는 Drand(League of Entropy) 라운드, Ed25519 서버 서명, 클라이언트 시드의 SHA-256 합성으로 결정됩니다.
          누구나{" "}
          <Link to="/apex/verify/1" className="text-primary underline-offset-4 hover:underline">
            Verify 페이지
          </Link>
          에서 결과를 재검증할 수 있습니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">신뢰 지표</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["출금 p95", "< 6분"],
            ["정산", "즉시"],
            ["VRF", "Drand × Ed25519"],
            ["오라클", "3-소스 합의"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="mt-1 text-lg font-bold">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">자주 묻는 질문</h2>
        <div className="mt-4 space-y-4">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-lg border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-foreground/90">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          <Link to="/apex" className="text-primary underline-offset-4 hover:underline">ApexForge 입장</Link>
          {" · "}
          <Link to="/apex/health" className="underline-offset-4 hover:underline">Health Dock</Link>
          {" · "}
          <Link to="/legal/terms" className="underline-offset-4 hover:underline">약관</Link>
        </p>
      </section>
    </main>
  );
}
