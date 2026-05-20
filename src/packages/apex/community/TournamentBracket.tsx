interface Slot { name: string; score?: number; winner?: boolean }
export interface BracketProps { slots: Slot[] }

export default function TournamentBracket({ slots }: BracketProps) {
  const padded = [...slots, ...Array(Math.max(0, 8 - slots.length)).fill({ name: "TBD" })].slice(0, 8);
  return (
    <svg viewBox="0 0 600 320" className="w-full h-auto" role="img" aria-label="tournament bracket">
      {padded.map((s, i) => (
        <g key={`r1-${i}`}>
          <rect x={10} y={20 + i * 36} width={140} height={28} rx={6}
            className={s.winner ? "fill-primary/25 stroke-primary" : "fill-muted/40 stroke-border"} strokeWidth={1} />
          <text x={20} y={38 + i * 36} className="fill-foreground text-[11px] font-bold">{s.name}</text>
          {typeof s.score === "number" && (
            <text x={140} y={38 + i * 36} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{s.score}</text>
          )}
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`r2-${i}`} x={200} y={40 + i * 72} width={140} height={28} rx={6}
          className="fill-muted/30 stroke-border" strokeWidth={1} />
      ))}
      {[0, 1].map((i) => (
        <rect key={`sf-${i}`} x={390} y={80 + i * 144} width={140} height={28} rx={6}
          className="fill-muted/30 stroke-border" strokeWidth={1} />
      ))}
      <rect x={430} y={152} width={140} height={32} rx={6} className="fill-accent/20 stroke-accent" strokeWidth={1.5} />
      <text x={500} y={172} textAnchor="middle" className="fill-foreground text-[12px] font-black">FINAL</text>
    </svg>
  );
}
