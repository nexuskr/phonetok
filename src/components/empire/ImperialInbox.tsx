/**
 * ImperialInbox — 황제 소식함
 * Warm Gold Bell + unread dot + BottomSheet 형태의 최근 50건 소식 리스트.
 * localStorage 기반 (`phonara:inbox:v1`), `phonara:inbox-add` / `phonara:inbox-update` 이벤트 구독.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Inbox as InboxIcon, Check, Crown } from "lucide-react";
import { inbox, type InboxItem } from "@/lib/notify";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const KIND_EMOJI: Record<string, string> = {
  jackpot: "💎",
  big_win: "🏆",
  win_small: "✨",
  loss_small: "·",
  liq: "🛡",
  imperial: "👑",
  deposit: "💰",
  withdrawal: "🏦",
  level_up: "📈",
};

function emojiFor(kind?: string) {
  if (!kind) return "👑";
  return KIND_EMOJI[kind] ?? "👑";
}

export default function ImperialInbox({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => setItems(inbox.list()), []);

  useEffect(() => {
    refresh();
    const onAdd = () => refresh();
    const onUpd = () => refresh();
    window.addEventListener("phonara:inbox-add", onAdd as EventListener);
    window.addEventListener("phonara:inbox-update", onUpd as EventListener);
    return () => {
      window.removeEventListener("phonara:inbox-add", onAdd as EventListener);
      window.removeEventListener("phonara:inbox-update", onUpd as EventListener);
    };
  }, [refresh]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = items.filter((x) => !x.read).length;

  return (
    <>
      <button
        type="button"
        aria-label="황제 소식함"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full glass border border-amber-300/30 text-foreground hover:border-amber-300/70 transition press ${className}`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-amber-400 to-pink text-[10px] font-bold text-black flex items-center justify-center shadow-[0_0_10px_hsl(38_92%_55%/0.6)] animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-label="황제 소식함"
            className="fixed z-[81] right-2 left-2 md:left-auto md:right-4 top-16 md:top-20 md:w-[380px] max-h-[min(80vh,640px)] rounded-2xl overflow-hidden glass-strong border border-amber-300/40 shadow-[0_24px_64px_-12px_hsl(38_92%_25%/0.6)] flex flex-col"
          >
            <header className="px-4 py-3 flex items-center justify-between border-b border-amber-300/20 bg-gradient-to-r from-amber-500/10 via-transparent to-pink/10">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-imperial text-sm tracking-[0.2em] text-gradient-imperial">
                  황제 소식함
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  inbox.markAllRead();
                  refresh();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-300 transition"
              >
                <Check className="w-3 h-3" />
                모두 읽음
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/15 to-pink/10 flex items-center justify-center border border-amber-300/30">
                    <InboxIcon className="w-6 h-6 text-amber-300" />
                  </div>
                  <p className="font-imperial text-sm text-amber-200/90">
                    아직 도착한 소식이 없습니다
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    잭팟, 큰 승전보, 출금 완료 등<br />
                    황실의 굵직한 순간이 이곳에 모입니다
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {items.map((it) => {
                    const body = (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="text-xl leading-none mt-0.5">{emojiFor(it.kind)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h4
                                className={`text-[13px] truncate ${
                                  it.read ? "text-muted-foreground" : "text-foreground font-semibold"
                                }`}
                              >
                                {it.title}
                              </h4>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {timeAgo(it.ts)}
                              </span>
                            </div>
                            {it.body && (
                              <p className="text-xs text-muted-foreground mt-0.5 break-keep line-clamp-2">
                                {it.body}
                              </p>
                            )}
                          </div>
                          {!it.read && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_hsl(38_92%_55%/0.7)] mt-1.5 shrink-0" />
                          )}
                        </div>
                      </>
                    );
                    const cls = "block px-4 py-3 hover:bg-amber-300/5 transition press";
                    if (it.href) {
                      return (
                        <li key={it.id}>
                          <Link
                            to={it.href}
                            className={cls}
                            onClick={() => {
                              inbox.markAllRead();
                              setOpen(false);
                            }}
                          >
                            {body}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={it.id} className={cls}>
                        {body}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="px-4 py-2 border-t border-border/30 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  최근 {items.length}건 · 자동 50건 유지
                </span>
                <button
                  type="button"
                  onClick={() => {
                    inbox.clear();
                    refresh();
                  }}
                  className="text-muted-foreground hover:text-destructive transition"
                >
                  모두 비우기
                </button>
              </footer>
            )}
          </aside>
        </>
      )}
    </>
  );
}
