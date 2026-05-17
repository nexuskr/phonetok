import { Users } from "lucide-react";

export function SpectatorCount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200/90 tabular-nums">
      <Users className="w-3 h-3" />
      {value.toLocaleString()} 관전
    </span>
  );
}

export default SpectatorCount;
