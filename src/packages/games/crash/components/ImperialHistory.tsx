/**
 * ImperialHistory — horizontal scroll of last-N crash multipliers.
 * Color-codes by tier: gold (<2x), pink (>=2x), violet (>=10x).
 */
interface Entry { multiplier: number; id?: string }

interface Props {
  entries: Entry[];
}

export default function ImperialHistory({ entries }: Props) {
  if (!entries.length) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
        최근 라운드 기록을 준비 중…
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-2 py-2 overflow-x-auto">
      <ul className="flex gap-1.5 min-w-max">
        {entries.map((e, i) => {
          const m = e.multiplier;
          const tone =
            m >= 10 ? "bg-[hsl(var(--pink))]/15 text-[hsl(var(--pink))] border-[hsl(var(--pink))]/40"
              : m >= 2 ? "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/40"
                : "bg-destructive/10 text-destructive border-destructive/30";
          return (
            <li
              key={e.id ?? i}
              className={`px-2 h-7 rounded-md border text-[11px] font-black tabular-nums flex items-center ${tone}`}
            >
              {m.toFixed(2)}x
            </li>
          );
        })}
      </ul>
    </div>
  );
}
