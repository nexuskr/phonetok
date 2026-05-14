// Week 3 Viral — Forced share moment full-screen dialog (always dismissible)
import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useForcedShare, logShareAction, buildShareUrl } from "@/lib/viralShare";
import { Twitter, Send, MessageCircle, Copy, Sparkles } from "lucide-react";
import { notify } from "@/lib/notify";

const CHANNELS = [
  { id: "x", label: "X", icon: Twitter, build: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { id: "telegram", label: "Telegram", icon: Send, build: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "line", label: "LINE", icon: MessageCircle, build: (url: string, text: string) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "kakao", label: "KakaoTalk", icon: MessageCircle, build: (url: string, text: string) =>
      `https://story.kakao.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
];

export default function ForcedShareDialog() {
  const { open, payload, close } = useForcedShare();

  const refCode = useMemo(() => {
    try { return localStorage.getItem("pm_my_ref_code") ?? undefined; } catch { return undefined; }
  }, [open]);
  const url = buildShareUrl(refCode);
  const text = payload ? `${payload.title}${payload.hashtag ? " " + payload.hashtag : ""}` : "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!payload) return null;

  const handleShare = (ch: typeof CHANNELS[number]) => {
    const u = ch.build(url, text);
    window.open(u, "_blank", "noopener,noreferrer,width=600,height=600");
    void logShareAction(payload.trigger, "shared", ch.id);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      notify.success("링크가 복사되었습니다");
      void logShareAction(payload.trigger, "copied", "clipboard");
    } catch {
      notify.error("복사 실패");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md border-primary/40">
        <DialogTitle className="sr-only">공유</DialogTitle>
        <DialogDescription className="sr-only">{payload.title}</DialogDescription>
        <div className="text-center space-y-4 py-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" /> SHARE THE WIN
          </div>
          <h2 className="text-2xl font-extrabold leading-tight">{payload.title}</h2>
          {payload.subtitle && (
            <p className="text-muted-foreground text-sm">{payload.subtitle}</p>
          )}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleShare(ch)}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-semibold">{ch.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleCopy}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition text-sm font-semibold"
          >
            <Copy className="h-4 w-4" /> 링크 복사
          </button>
          <button
            onClick={close}
            className="text-xs text-muted-foreground hover:text-foreground transition pt-1"
          >
            나중에 공유
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
