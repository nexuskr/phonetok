import { useChatChannel as _useChatChannel } from "@/packages/realtime";

export function useApexChatChannel(roomId: string, onInsert: (row: any) => void) {
  return _useChatChannel({
    key: `chat:apex:room:${roomId}`,
    bindings: [
      { event: "INSERT", schema: "public", table: "apex_chat_messages", filter: `room_id=eq.${roomId}` },
    ],
    onEvent: (p: any) => { if (p.eventType === "INSERT") onInsert(p.new); },
    enabled: !!roomId,
  });
}
