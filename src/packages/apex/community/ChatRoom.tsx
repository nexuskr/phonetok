import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";
import { ChatMessage, type ChatMsg } from "./ChatMessage";
import { useApexChatChannel } from "./hooks/useChatChannel";

const GLOBAL_NAME = "Global Lobby";

export default function ChatRoom() {
  const [roomId, setRoomId] = useState<string>("");
  const [me, setMe] = useState<string>("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u?.user?.id ?? "");
      const { data: r } = await supabase
        .from("apex_chat_rooms" as any)
        .select("id")
        .eq("type", "global")
        .eq("name", GLOBAL_NAME)
        .maybeSingle();
      if ((r as any)?.id) setRoomId((r as any).id);
    })();
  }, []);

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const { data } = await supabase
        .from("apex_chat_messages" as any)
        .select("id,user_id,message,drand_round,drand_signature,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(80);
      setMsgs(((data ?? []) as unknown as ChatMsg[]).reverse());
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    })();
  }, [roomId]);

  useApexChatChannel(roomId, (row) => {
    setMsgs((m) => [...m.slice(-200), row as ChatMsg]);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  });

  async function send() {
    const text = draft.trim();
    if (!text || !roomId || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("apex_send_chat_message" as any, {
        _room_id: roomId, _message: text,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) {
        if (res?.error === "throttled") notify.warning("천천히 — 3초 후 다시 보내세요");
        else notify.warning(res?.error ?? "전송 실패");
        return;
      }
      setDraft("");
      try {
        supabase.functions.invoke("apex-chat-stamp", { body: { message_id: res.message_id } }).catch(() => {});
      } catch { /* ignore */ }
    } catch (e) {
      notify.error("채팅 오류", { description: describeError(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">GLOBAL LOBBY</h1>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Drand-stamped · provably fair
        </span>
      </div>
      <div className="rounded-xl border border-border bg-card/50">
        <div className="p-4 flex flex-col h-[60vh]">
          <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
            {msgs.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-12">
                첫 메시지를 남겨보세요.
              </div>
            ) : (
              msgs.map((m) => <ChatMessage key={m.id} msg={m} mine={m.user_id === me} />)
            )}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="메시지 입력 (500자, 3초 쿨다운)"
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2 text-sm resize-none"
            />
            <button onClick={send} disabled={sending || !draft.trim() || !roomId}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground text-right tabular-nums">
            {draft.length}/500
          </div>
        </div>
      </div>
    </div>
  );
}
