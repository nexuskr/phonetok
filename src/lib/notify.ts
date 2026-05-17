/**
 * notify — single source of truth for toast notifications.
 *
 * All app code should import from here instead of calling sonner.toast directly,
 * so we can:
 *  - guarantee consistent visual style (design tokens, Warm King + Imperial Gold)
 *  - centralize copy ("문제가 발생했습니다" 등)
 *  - normalize unknown errors into user-friendly Korean messages
 *  - LRU dedupe to prevent repeat spam
 *  - route 잔돈성 알림 → 황제 소식함 (Inbox)
 */
import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";
import {
  classifyLossAmount,
  classifyWinAmount,
  type WinClass,
} from "@/lib/notify-thresholds";

type Opts = ExternalToast & { description?: ReactNode };

const baseClass =
  "border border-border/60 bg-card/95 text-foreground backdrop-blur-xl shadow-[0_8px_32px_hsl(240_50%_1%/0.7)]";

const variantClass = {
  success: "border-primary/40",
  error: "border-destructive/50",
  info: "border-secondary/40",
  warning: "border-accent/40",
  imperial:
    "border-amber-400/60 shadow-[0_16px_48px_-8px_hsl(38_92%_55%/0.55),0_2px_0_hsl(45_95%_70%/0.25)_inset] ring-1 ring-amber-300/30",
  default: "",
} as const;

function fmt(
  message: ReactNode,
  variant: keyof typeof variantClass,
  opts?: Opts,
) {
  return {
    ...opts,
    className: [baseClass, variantClass[variant], opts?.className ?? ""]
      .filter(Boolean)
      .join(" "),
  };
}

/** Normalize unknown errors (Error, Supabase PostgrestError, string, unknown). */
export function describeError(err: unknown, fallback = "잠시 후 다시 시도해 주세요."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const anyErr = err as { message?: string; error_description?: string; hint?: string };
    return anyErr.message || anyErr.error_description || anyErr.hint || fallback;
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────
// DEDUPE: LRU + TTL — same (tier|key) 4초 내 중복 차단
// ─────────────────────────────────────────────────────────────
const DEDUPE_TTL_MS = 4_000;
const DEDUPE_MAX = 64;
const dedupeMap = new Map<string, number>();

function passDedupe(key: string): boolean {
  const now = Date.now();
  const last = dedupeMap.get(key);
  if (last && now - last < DEDUPE_TTL_MS) return false;
  dedupeMap.set(key, now);
  if (dedupeMap.size > DEDUPE_MAX) {
    // drop oldest
    const firstKey = dedupeMap.keys().next().value;
    if (firstKey !== undefined) dedupeMap.delete(firstKey);
  }
  return true;
}

function dedupeKey(tier: string, message: ReactNode, k?: string): string {
  if (k) return `${tier}:${k}`;
  const txt = typeof message === "string" ? message : JSON.stringify(message);
  return `${tier}:${txt}`;
}

// ─────────────────────────────────────────────────────────────
// INBOX: 황제 소식함 (localStorage + custom event)
// ─────────────────────────────────────────────────────────────
const INBOX_KEY = "phonara:inbox:v1";
const INBOX_MAX = 50;

export type InboxItem = {
  id: string;
  ts: number;
  title: string;
  body?: string;
  kind?: string;
  href?: string;
  read?: boolean;
};

function loadInbox(): InboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, INBOX_MAX) : [];
  } catch {
    return [];
  }
}

function saveInbox(items: InboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, INBOX_MAX)));
  } catch {
    /* quota */
  }
}

function pushInbox(item: Omit<InboxItem, "id" | "ts" | "read"> & { id?: string }): InboxItem {
  const full: InboxItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    read: false,
    title: item.title,
    body: item.body,
    kind: item.kind,
    href: item.href,
  };
  const cur = loadInbox();
  cur.unshift(full);
  saveInbox(cur);
  try {
    window.dispatchEvent(new CustomEvent("phonara:inbox-add", { detail: full }));
  } catch {
    /* ignore */
  }
  return full;
}

export const inbox = {
  list: loadInbox,
  push: pushInbox,
  markAllRead: () => {
    const cur = loadInbox().map((x) => ({ ...x, read: true }));
    saveInbox(cur);
    try { window.dispatchEvent(new CustomEvent("phonara:inbox-update")); } catch {}
  },
  remove: (id: string) => {
    const cur = loadInbox().filter((x) => x.id !== id);
    saveInbox(cur);
    try { window.dispatchEvent(new CustomEvent("phonara:inbox-update")); } catch {}
  },
  clear: () => {
    saveInbox([]);
    try { window.dispatchEvent(new CustomEvent("phonara:inbox-update")); } catch {}
  },
  unreadCount: () => loadInbox().filter((x) => !x.read).length,
};

// ─────────────────────────────────────────────────────────────
// Internal: tier wrappers with dedupe
// ─────────────────────────────────────────────────────────────
function withDedupe<T>(
  tier: string,
  message: ReactNode,
  opts: Opts | undefined,
  fire: () => T,
): T | undefined {
  const k = dedupeKey(tier, message, (opts as any)?.dedupeKey);
  if (!passDedupe(k)) return undefined;
  return fire();
}

export const notify = {
  success: (message: ReactNode, opts?: Opts) =>
    withDedupe("success", message, opts, () =>
      sonner.success(message, fmt(message, "success", opts)),
    ),
  error: (message: ReactNode, opts?: Opts) =>
    withDedupe("error", message, opts, () =>
      sonner.error(message, fmt(message, "error", opts)),
    ),
  info: (message: ReactNode, opts?: Opts) =>
    withDedupe("info", message, opts, () =>
      sonner.info?.(message, fmt(message, "info", opts)) ??
      sonner(message, fmt(message, "info", opts)),
    ),
  warning: (message: ReactNode, opts?: Opts) =>
    withDedupe("warning", message, opts, () =>
      sonner.warning?.(message, fmt(message, "warning", opts)) ??
      sonner(message, fmt(message, "warning", opts)),
    ),
  message: (message: ReactNode, opts?: Opts) =>
    withDedupe("default", message, opts, () =>
      sonner(message, fmt(message, "default", opts)),
    ),
  loading: (message: ReactNode, opts?: Opts) =>
    // loading toasts skip dedupe (each in-flight op needs its own id)
    sonner.loading(message, fmt(message, "default", opts)),
  /** Convenience: report an unknown error with a Korean fallback. */
  fail: (title: string, err?: unknown, opts?: Opts) =>
    withDedupe("error", title, opts, () =>
      sonner.error(title, fmt(title, "error", { description: describeError(err), ...opts })),
    ),
  promise: sonner.promise.bind(sonner),
  dismiss: sonner.dismiss.bind(sonner),

  // ─────────────────────────────────────────────────────────────
  // 4-TIER NOTIFICATION SYSTEM (LOCKED v3.0 Week 1 #1)
  // ─────────────────────────────────────────────────────────────
  critical: (message: ReactNode, opts?: Opts) =>
    sonner.error(message, fmt(message, "error", { duration: Infinity, ...opts })),
  important: (message: ReactNode, opts?: Opts) =>
    withDedupe("important", message, opts, () =>
      sonner(message, fmt(message, "info", { duration: 6000, ...opts })),
    ),
  passive: (message: ReactNode, opts?: Opts) =>
    withDedupe("passive", message, opts, () =>
      sonner(message, fmt(message, "default", { duration: 2500, ...opts })),
    ),
  /** 절대 popup 금지. activity rail/telemetry로만 흘려보낸다. */
  silent: (message: ReactNode, payload?: Record<string, unknown>) => {
    try {
      window.dispatchEvent(
        new CustomEvent("phonara:silent-notify", {
          detail: { message: String(message), payload, ts: Date.now() },
        }),
      );
    } catch {
      /* ignore */
    }
  },

  // ─────────────────────────────────────────────────────────────
  // IMPERIAL TIER — Warm King 황실 토스트 + 자동 Inbox 적재
  // ─────────────────────────────────────────────────────────────
  /**
   * Warm Gold 강조 토스트. 잭팟·Baron 승급·시즌 종료 같은 황실 순간 전용.
   * 자동으로 황제 소식함에도 적재된다.
   */
  imperial: (title: ReactNode, opts?: Opts & { href?: string; kind?: string }) => {
    const titleStr = typeof title === "string" ? title : String(title);
    const description = opts?.description;
    const descStr =
      typeof description === "string" ? description : description ? String(description) : undefined;
    const result = withDedupe("imperial", titleStr, opts, () =>
      sonner(`👑 ${titleStr}`, fmt(`👑 ${titleStr}`, "imperial", { duration: 6500, ...opts })),
    );
    // Inbox 적재 (dedupe와 별개로 항상 누적)
    pushInbox({
      title: titleStr,
      body: descStr,
      kind: opts?.kind ?? "imperial",
      href: opts?.href,
    });
    return result;
  },

  // ─────────────────────────────────────────────────────────────
  // RESULT — 게임/트레이딩/슬롯 결과 단일 진입점
  // ─────────────────────────────────────────────────────────────
  /**
   * 결과 토스트 라우터.
   *  - jackpot / big win → imperial() (강력 + Inbox)
   *  - 일반 win/loss → passive() (자동 소멸)
   *  - liquidation → important() + Inbox
   *  - small → silent() + Inbox only
   */
  result: (input: {
    kind: "win" | "loss" | "jackpot" | "liq";
    amountPhon: number;
    title?: string;
    description?: string;
    symbol?: string;
    href?: string;
  }) => {
    const abs = Math.abs(input.amountPhon);
    const formatted = `${input.amountPhon >= 0 ? "+" : "-"}${Math.floor(abs).toLocaleString("ko-KR")} PHON`;
    const symbolTxt = input.symbol ? ` · ${input.symbol}` : "";

    if (input.kind === "jackpot") {
      return notify.imperial(input.title ?? "잭팟! 황금의 비가 내립니다", {
        description: input.description ?? `${formatted}${symbolTxt}`,
        href: input.href,
        kind: "jackpot",
      });
    }
    if (input.kind === "liq") {
      const cls = classifyLossAmount(input.amountPhon);
      if (cls === "liq") {
        const t = input.title ?? "포지션이 청산되었어요";
        sonner(t, fmt(t, "error", { duration: 7000 }));
        pushInbox({
          title: t,
          body: input.description ?? `${formatted}${symbolTxt} · 다시 흐름을 봅시다`,
          kind: "liq",
          href: input.href,
        });
        return;
      }
      // small liquidation → silent + inbox
      pushInbox({
        title: input.title ?? "소액 청산",
        body: input.description ?? `${formatted}${symbolTxt}`,
        kind: "liq",
        href: input.href,
      });
      return;
    }

    if (input.kind === "win") {
      const cls: WinClass = classifyWinAmount(abs);
      if (cls === "jackpot" || cls === "big") {
        return notify.imperial(
          input.title ?? (cls === "jackpot" ? "잭팟! 황금의 비가 내립니다" : "큰 승전보가 도착했어요"),
          {
            description: input.description ?? `${formatted}${symbolTxt}`,
            href: input.href,
            kind: cls === "jackpot" ? "jackpot" : "big_win",
          },
        );
      }
      if (cls === "normal") {
        notify.passive(input.title ?? "승리 ✨", {
          description: input.description ?? `${formatted}${symbolTxt}`,
        });
        return;
      }
      // small → silent + inbox
      pushInbox({
        title: input.title ?? "소소한 승리",
        body: input.description ?? `${formatted}${symbolTxt}`,
        kind: "win_small",
        href: input.href,
      });
      return;
    }

    // loss
    const cls = classifyLossAmount(input.amountPhon);
    if (cls === "loss") {
      notify.passive(input.title ?? "다음 흐름을 노려봐요", {
        description: input.description ?? `${formatted}${symbolTxt}`,
      });
      return;
    }
    // small loss → silent + inbox
    pushInbox({
      title: input.title ?? "소소한 손실",
      body: input.description ?? `${formatted}${symbolTxt}`,
      kind: "loss_small",
      href: input.href,
    });
  },
};

export type Notify = typeof notify;
