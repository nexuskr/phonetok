import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApexFairBadge({
  hash, seed, nonce, className,
}: { hash?: string | null; seed?: string | null; nonce?: number | null; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/60 px-2.5 py-1 text-[10px] font-black tracking-wider text-primary backdrop-blur hover:bg-primary/10 transition"
      >
        <ShieldCheck className="w-3 h-3" /> PROVABLY FAIR
      </button>
      {open && (
        <div className="apex-glass rounded-xl p-3 text-[10px] font-mono space-y-1 max-w-[300px] break-all">
          <div><span className="text-primary">hash</span>: {hash ?? "—"}</div>
          <div><span className="text-primary">seed</span>: {seed ?? "(reveals after round)"}</div>
          <div><span className="text-primary">nonce</span>: {nonce ?? 0}</div>
        </div>
      )}
    </div>
  );
}
