import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bell, Send } from "lucide-react";

const CHANNELS = [
  { id: "inapp", label: "인앱" },
  { id: "push", label: "푸시" },
  { id: "telegram", label: "Telegram" },
] as const;

type Broadcast = {
  id: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
};

export default function NotificationCenter() {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["id"]>("inapp");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("{}");
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_broadcasts", { _limit: 50 });
    if (error) notify.error(error.message);
    setList((data as Broadcast[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) {
      notify.error("제목과 본문을 입력하세요.");
      return;
    }
    let aud: any = {};
    try {
      aud = audience.trim() ? JSON.parse(audience) : {};
    } catch {
      notify.error("Audience JSON 형식이 올바르지 않습니다.");
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("admin_broadcast_send", {
      _channel: channel,
      _title: title,
      _body: body,
      _audience: aud,
    });
    setSending(false);
    if (error) {
      notify.error(error.message);
      return;
    }
    notify.success(`${channel} 브로드캐스트 발송 완료`);
    setTitle("");
    setBody("");
    setAudience("{}");
    load();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl flex items-center gap-2">
          <Bell className="w-5 h-5" /> 🔔 공지 센터
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          전체 유저에게 인앱 / 푸시 / Telegram 메시지를 즉시 발송합니다.
        </p>
      </header>

      <div className="glass-strong rounded-2xl p-5 border border-border/40 space-y-4">
        <div className="flex gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChannel(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                channel === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">제목</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">본문</label>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="본문을 입력하세요"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            대상 (Audience JSON, 비워두면 전체)
          </label>
          <Input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder='{"tier": "baron"}'
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={send} disabled={sending} className="gap-2">
          <Send className="w-4 h-4" /> {sending ? "발송 중…" : "지금 발송"}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-sm text-muted-foreground">최근 발송 내역</h2>
        {loading ? (
          <LoadingList rows={4} />
        ) : list.length === 0 ? (
          <EmptyState title="발송 내역 없음" description="아직 보낸 공지가 없습니다." icon={<Bell className="w-6 h-6" />} />
        ) : (
          <div className="glass-strong rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">시각</th>
                  <th className="text-left p-3">채널</th>
                  <th className="text-left p-3">제목</th>
                  <th className="text-left p-3">상태</th>
                  <th className="text-right p-3">발송 수</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-t border-border/30">
                    <td className="p-3 text-xs">{new Date(b.created_at).toLocaleString("ko-KR")}</td>
                    <td className="p-3 text-xs uppercase">{b.channel}</td>
                    <td className="p-3 font-medium">{b.title}</td>
                    <td className="p-3 text-xs">{b.status}</td>
                    <td className="p-3 text-right font-mono">{b.sent_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
