// Provably-fair attestation trace card. Pure read-only UI.
import { useVrfTrace } from "./useVrfTrace";

type Props = { game: string; roundRef: string };

function truncate(s: string | null, n = 18) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function VrfTraceCard({ game, roundRef }: Props) {
  const { trace, loading } = useVrfTrace(game, roundRef);

  if (loading && !trace) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        VRF 트레이스 불러오는 중…
      </div>
    );
  }
  if (!trace) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        이 라운드에 대한 VRF 트레이스가 아직 기록되지 않았습니다. (백필 cron 1분 주기)
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card/80 p-5 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-bold text-primary">🔒 VRF v2.5 — Drand × Ed25519</p>
        {trace.drand_round != null && (
          <a
            href={`https://api.drand.sh/public/${trace.drand_round}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Drand Explorer →
          </a>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Drand Round</dt>
          <dd className="mt-0.5 font-mono">{trace.drand_round ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Drand Randomness</dt>
          <dd className="mt-0.5 break-all font-mono">{truncate(trace.drand_randomness, 32)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Server Signature (Ed25519)</dt>
          <dd className="mt-0.5 break-all font-mono">{truncate(trace.server_signature, 32)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Server PubKey</dt>
          <dd className="mt-0.5 break-all font-mono">{truncate(trace.server_pubkey, 32)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Client Seed</dt>
          <dd className="mt-0.5 break-all font-mono">{truncate(trace.client_seed, 32)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">Composed Seed (SHA-256)</dt>
          <dd className="mt-0.5 break-all font-mono">{truncate(trace.composed_seed, 32)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        composed_seed = SHA-256(drand_randomness ‖ server_signature ‖ client_seed)
      </p>
    </div>
  );
}
