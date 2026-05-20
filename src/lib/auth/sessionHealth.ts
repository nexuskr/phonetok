// P0-8 — Session health metrics (client-side observability)

import {
  TAB_ID,
  publishAuthEvent,
  subscribeAuthEvents,
  getLastAuthEvent,
  type AuthBroadcastPayload,
} from "./authBroadcast";

const REFRESH_RING_CAP = 20;
const PEER_TTL_MS = 8_000;
const HEARTBEAT_MS = 3_000;

export type RefreshRecord = {
  ts: number;
  ok: boolean;
  durationMs: number;
  error?: string;
};

type Peer = { tabId: string; lastSeen: number };

const refreshHistory: RefreshRecord[] = [];
let recover401Success = 0;
let recover401Failure = 0;
const peers = new Map<string, Peer>();
let heartbeatTimer: number | null = null;

export function recordRefresh(rec: RefreshRecord): void {
  refreshHistory.unshift(rec);
  if (refreshHistory.length > REFRESH_RING_CAP) {
    refreshHistory.length = REFRESH_RING_CAP;
  }
}

export function recordRecover401(ok: boolean): void {
  if (ok) recover401Success++;
  else recover401Failure++;
}

export type SessionHealthSnapshot = {
  tabId: string;
  refreshHistory: RefreshRecord[];
  recover401: { success: number; failure: number };
  peers: Peer[];
  lastEvent: AuthBroadcastPayload | null;
  broadcastSupported: boolean;
};

export function getSessionHealthSnapshot(): SessionHealthSnapshot {
  const now = Date.now();
  for (const [id, p] of peers) {
    if (now - p.lastSeen > PEER_TTL_MS) peers.delete(id);
  }
  return {
    tabId: TAB_ID,
    refreshHistory: [...refreshHistory],
    recover401: { success: recover401Success, failure: recover401Failure },
    peers: Array.from(peers.values()),
    lastEvent: getLastAuthEvent(),
    broadcastSupported:
      typeof window !== "undefined" && typeof BroadcastChannel !== "undefined",
  };
}

let started = false;
export function startSessionHealthHeartbeat(): void {
  if (started) return;
  started = true;
  if (typeof window === "undefined") return;

  subscribeAuthEvents((p) => {
    if (p?.tabId && p.tabId !== TAB_ID) {
      peers.set(p.tabId, { tabId: p.tabId, lastSeen: Date.now() });
    }
  });

  publishAuthEvent("TOKEN_REFRESHED", { hb: 1 });
  heartbeatTimer = window.setInterval(() => {
    publishAuthEvent("TOKEN_REFRESHED", { hb: 1 });
  }, HEARTBEAT_MS);
}

export function stopSessionHealthHeartbeat(): void {
  if (heartbeatTimer != null && typeof window !== "undefined") {
    window.clearInterval(heartbeatTimer);
  }
  heartbeatTimer = null;
  started = false;
}
