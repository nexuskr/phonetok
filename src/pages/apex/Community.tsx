import { useEffect, useState } from "react";
import { Users, Send, TrendingUp, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GlowCard } from "@/packages/apex/components/GlowCard";
import { NeonButton } from "@/packages/apex/components/NeonButton";
import { notify, describeError } from "@/lib/notify";

interface BigWin {
  id: string;
  masked_nick: string;
  game_code: string;
  bet_phon: number;
  payout_phon: number;
  multiplier: number;
  created_at: string;
}

interface ChatMsg {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname?: string;
}

export default function ApexCommunity() {
  const [wins, setWins] = useState<BigWin[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [w, c] = await Promise.all([
        supabase.rpc("get_apex_recent_rolls" as any, { _limit: 20 }),
        supabase.from("chat_messages" as any).select("id,user_id,content,created_at,nickname").order("created_at", { ascending: false }).limit(30),
      ]);
      if (alive && w.data) setWins(w.data as any);
      if (alive && c.data) setChat((c.data as any).reverse());
    };
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        notify.warning("로그인이 필요합니다");
        return;
      }
      const { error } = await supabase.from("chat_messages" as any).insert({ user_id: u.user.id, content: draft.trim() });
      if (error) throw error;
      setDraft("");
    } catch (e) {
      notify.error("전송 실패", { description: describeError(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black apex-gradient-text flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> COMMUNITY
        </h1>
        <Link to="/apex/free" className="text-[11px] uppercase tracking-widest text-accent border border-accent/40 rounded-full px-3 py-1 hover:bg-accent/10">
          <Gift className="inline w-3 h-3 mr-1" /> 친구 추천
        </Link>
      </div>

      {/* Big Wins */}
      <GlowCard glow="magenta" hover={false}>
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-black apex-text-magenta mb-3">
            <TrendingUp className="w-4 h-4" /> BIG WINS · 라이브
          </div>
          {wins.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">아직 큰 승리가 없어요. 첫 번째가 되어보세요.</div>
          ) : (
            <ul className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              {wins.map((w) => (
                <li key={w.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{w.masked_nick}</span>
                    <span className="text-[9px] uppercase text-muted-foreground border border-border rounded px-1.5 py-0.5">{w.game_code}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="apex-text-neon font-black tabular-nums">x{Number(w.multiplier).toFixed(2)}</span>
                    <span className="text-primary tabular-nums">+{Math.floor(Number(w.payout_phon)).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlowCard>

      {/* Chat */}
      <GlowCard hover={false}>
        <div className="p-4 flex flex-col h-[440px]">
          <div className="text-sm font-black apex-text-neon mb-2">GLOBAL CHAT</div>
          <ul className="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1">
            {chat.length === 0 && (
              <li className="text-muted-foreground text-center py-6">대화를 시작해보세요.</li>
            )}
            {chat.map((m) => (
              <li key={m.id} className="leading-relaxed">
                <span className="text-primary font-bold mr-1.5">{m.nickname?.slice(0, 8) || "anon"}</span>
                <span className="text-foreground/90">{m.content}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={200}
              placeholder="메시지…"
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2 text-xs"
            />
            <NeonButton size="md" onClick={send} disabled={sending || !draft.trim()}>
              <Send className="w-4 h-4" />
            </NeonButton>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
