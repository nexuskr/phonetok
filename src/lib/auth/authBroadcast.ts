// P0-8 — Multi-tab auth event broadcast
//
// 단일 채널 `phonara:auth` 로 SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED 이벤트를
// 다른 탭에 전파한다. SSR/미지원 환경에서는 모두 no-op.

export type AuthBroadcastEventType =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "RECOVER_401";

export type AuthBroadcastPayload = {
  type: AuthBroadcastEventType;
  ts: number;
  tabId: string;
  meta?: Record<string, unknown>;
};

const CHANNEL_NAME = "phonara:auth";

function genTabId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch { /* noop */ }
  return Math.random().toString(36).slice(2, 10);
}

export const TAB_ID: string = (() => {
  if (typeof window === "undefined") return "ssr";
  const w = window as any;
  if (!w.__phonara_tab_id__) w.__phonara_tab_id__ = genTabId();
  return w.__phonara_tab_id__;
})();

let channel: BroadcastChannel | null = null;
let lastEvent: AuthBroadcastPayload | null = null;
const handlers = new Set<(p: AuthBroadcastPayload) => void>();

function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent<AuthBroadcastPayload>) => {
      const p = ev?.data;
      if (!p || typeof p !== "object") return;
      // 자기 탭 echo 차단
      if (p.tabId === TAB_ID) return;
      lastEvent = p;
      handlers.forEach((h) => {
        try { h(p); } catch { /* noop */ }
      });
    };
  } catch {
    channel = null;
  }
  return channel;
}

export function publishAuthEvent(
  type: AuthBroadcastEventType,
  meta?: Record<string, unknown>,
): void {
  const ch = ensureChannel();
  const payload: AuthBroadcastPayload = { type, ts: Date.now(), tabId: TAB_ID, meta };
  lastEvent = payload;
  if (!ch) return;
  try { ch.postMessage(payload); } catch { /* noop */ }
}

export function subscribeAuthEvents(
  handler: (p: AuthBroadcastPayload) => void,
): () => void {
  ensureChannel();
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export function getLastAuthEvent(): AuthBroadcastPayload | null {
  return lastEvent;
}

export function isAuthBroadcastSupported(): boolean {
  return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";
}
