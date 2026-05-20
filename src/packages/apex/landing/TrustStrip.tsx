// Trust strip — static, no network.
import { Link } from "react-router-dom";

export default function TrustStrip() {
  return (
    <section className="mx-auto my-10 max-w-6xl px-2">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-5 sm:grid-cols-4">
        {[
          ["출금 p95", "< 6분"],
          ["정산", "즉시 (Crash V2)"],
          ["VRF", "Drand + Ed25519"],
          ["오라클", "3-소스 합의"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="mt-1 text-lg font-bold text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/safe" className="underline-offset-4 hover:underline">플랫폼 소개</Link>
        {" · "}
        <Link to="/apex/health" className="underline-offset-4 hover:underline">Health Dock</Link>
        {" · "}
        <Link to="/apex/verify/1" className="underline-offset-4 hover:underline">Verify</Link>
      </p>
    </section>
  );
}
