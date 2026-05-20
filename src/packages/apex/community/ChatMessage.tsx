import { ShieldCheck } from "lucide-react";
import { drandSummary } from "./lib/drandVerify";

export interface ChatMsg {
  id: string;
  user_id: string;
  message: string;
  drand_round: number | null;
  drand_signature: string | null;
  created_at: string;
}

export function ChatMessage({ msg, mine }: { msg: ChatMsg; mine: boolean }) {
  const d = drandSummary(msg.drand_round, msg.drand_signature);
  const time = new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-xl px-3 py-2 text-sm shadow-sm border ${
        mine ? "bg-primary/15 border-primary/40" : "bg-muted/40 border-border"
      }`}>
        <div className="break-words whitespace-pre-wrap">{msg.message}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{time}</span>
          <span aria-hidden>·</span>
          {d.ok ? (
            <a href={d.url} target="_blank" rel="noreferrer" title={d.label}
              className="inline-flex items-center gap-1 hover:text-primary transition">
              <ShieldCheck className="w-3 h-3" />
              <span className="tabular-nums">drand #{msg.drand_round}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 italic">
              <ShieldCheck className="w-3 h-3" /> stamping…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
