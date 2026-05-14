// Week 3 Viral — Forced share moment store + helpers
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type ShareTrigger =
  | "crown_jackpot"
  | "baron_promotion"
  | "big_withdrawal"
  | "tournament_win"
  | "manual";

type SharePayload = {
  trigger: ShareTrigger;
  title: string;
  subtitle?: string;
  hashtag?: string;
  ogPath?: string; // path under og-card-renderer
};

type State = {
  open: boolean;
  payload: SharePayload | null;
  fire: (p: SharePayload) => void;
  close: () => void;
};

export const useForcedShare = create<State>((set, get) => ({
  open: false,
  payload: null,
  fire: (p) => {
    // Throttle: at most once per 90s per trigger
    try {
      const k = `pm_share_fire_${p.trigger}`;
      const last = Number(localStorage.getItem(k) ?? "0");
      if (Date.now() - last < 90_000) return;
      localStorage.setItem(k, String(Date.now()));
    } catch {}
    void supabase.rpc("log_share_event", {
      _trigger: p.trigger, _action: "shown", _channel: null, _payload: { title: p.title },
    });
    set({ open: true, payload: p });
  },
  close: () => {
    const cur = get().payload;
    if (cur) {
      void supabase.rpc("log_share_event", {
        _trigger: cur.trigger, _action: "dismissed", _channel: null, _payload: {},
      });
    }
    set({ open: false, payload: null });
  },
}));

export async function logShareAction(trigger: ShareTrigger, action: "shared" | "copied", channel: string) {
  try {
    await supabase.rpc("log_share_event", {
      _trigger: trigger, _action: action, _channel: channel, _payload: {},
    });
  } catch {}
}

export function buildShareUrl(refCode?: string): string {
  const base = "https://phonara.world";
  if (refCode) return `${base}/?ref=${encodeURIComponent(refCode)}`;
  return base;
}
