import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Sparkles, Copy, Wand2, AlertTriangle, Loader2 } from "lucide-react";

type Channel = "tiktok" | "instagram" | "threads" | "naver" | "youtube" | "kakao";
type Tone = "friendly" | "formal" | "playful" | "hype";

const CHANNELS: { id: Channel; emoji: string }[] = [
  { id: "tiktok", emoji: "🎵" },
  { id: "instagram", emoji: "📸" },
  { id: "threads", emoji: "🧵" },
  { id: "naver", emoji: "🟢" },
  { id: "youtube", emoji: "▶️" },
  { id: "kakao", emoji: "💬" },
];

const TONES: Tone[] = ["friendly", "formal", "playful", "hype"];

const SAFE_DAILY = 60;     // 20 × 3계정
const WARN_DAILY = 100;
const HARD_DAILY = 300;

const todayKey = () => `dm_sent_${new Date().toISOString().slice(0, 10)}`;

export default function DMComposer({ referralLink }: { referralLink?: string }) {
  const { t } = useTranslation("dmComposer");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [keywords, setKeywords] = useState("부업, AI, 재테크");
  const [persona, setPersona] = useState("20~30대 직장인 부업 관심층");
  const [tone, setTone] = useState<Tone>("friendly");
  const [count, setCount] = useState(5);
  const [variants, setVariants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentToday, setSentToday] = useState(0);

  useEffect(() => {
    const v = Number(localStorage.getItem(todayKey()) || "0");
    setSentToday(Number.isFinite(v) ? v : 0);
  }, []);

  const dangerLevel = useMemo<"safe" | "warn" | "danger">(() => {
    if (sentToday >= WARN_DAILY) return "danger";
    if (sentToday >= SAFE_DAILY) return "warn";
    return "safe";
  }, [sentToday]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dm-composer", {
        body: { channel, keywords, persona, tone, count, referralLink },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVariants(Array.isArray(data?.variants) ? data.variants : []);
      toast({ title: t("toast.generatedTitle"), description: t("toast.generatedDesc", { n: data?.variants?.length ?? 0 }) });
    } catch (e: any) {
      const msg = e?.message ?? "error";
      const desc =
        msg === "rate_limited" ? t("toast.rateLimit")
        : msg === "payment_required" ? t("toast.paymentRequired")
        : t("toast.genericError");
      toast({ title: t("toast.errorTitle"), description: desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyVariant = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      const next = Math.min(HARD_DAILY, sentToday + 1);
      setSentToday(next);
      localStorage.setItem(todayKey(), String(next));
      toast({ title: t("toast.copiedTitle"), description: t("toast.copiedDesc", { n: next }) });
    } catch {
      toast({ title: t("toast.copyFailed"), variant: "destructive" });
    }
  };

  const resetCounter = () => {
    setSentToday(0);
    localStorage.setItem(todayKey(), "0");
  };

  return (
    <section>
      <h2 className="font-display font-black text-lg mb-1 flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-primary" /> {t("title")}
      </h2>
      <p className="text-xs text-muted-foreground mb-3 break-keep">{t("subtitle")}</p>

      <div className="glass rounded-2xl p-4 border border-border space-y-3">
        {/* Channel picker */}
        <div>
          <div className="text-[11px] font-bold text-muted-foreground mb-1.5">{t("fields.channel")}</div>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`min-h-[40px] rounded-lg text-xs font-bold border transition-colors ${
                  channel === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground/80"
                }`}
              >
                <span className="mr-1">{c.emoji}</span>
                {t(`channels.${c.id}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground">{t("fields.keywords")}</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm"
            placeholder="부업, AI, 재테크"
          />
        </div>

        {/* Persona */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground">{t("fields.persona")}</label>
          <input
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm"
            placeholder="20~30대 직장인 부업 관심층"
          />
        </div>

        {/* Tone & count */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground">{t("fields.tone")}</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full mt-1 rounded-lg bg-background border border-border px-2 py-2 text-sm"
            >
              {TONES.map((tn) => (
                <option key={tn} value={tn}>{t(`tones.${tn}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground">{t("fields.count")}</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full mt-1 rounded-lg bg-background border border-border px-2 py-2 text-sm"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="min-h-[44px] w-full rounded-xl bg-gradient-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? t("generating") : t("generate")}
        </button>
      </div>

      {/* Daily safe-line counter */}
      <div className={`mt-3 rounded-xl p-3 border text-xs flex items-start gap-2 ${
        dangerLevel === "safe" ? "bg-card border-border text-muted-foreground"
        : dangerLevel === "warn" ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-200"
        : "bg-destructive/10 border-destructive/40 text-destructive"
      }`}>
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 break-keep">
          <div className="font-bold">
            {t("safeline.title", { n: sentToday })}
          </div>
          <div className="opacity-80 mt-0.5">
            {dangerLevel === "danger" ? t("safeline.danger") :
             dangerLevel === "warn" ? t("safeline.warn") :
             t("safeline.safe", { safe: SAFE_DAILY })}
          </div>
        </div>
        <button onClick={resetCounter} className="text-[10px] underline opacity-70 hover:opacity-100">
          {t("safeline.reset")}
        </button>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div className="mt-4 space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="glass rounded-2xl p-3 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-primary">#{i + 1}</span>
                <button
                  onClick={() => copyVariant(v)}
                  className="text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25"
                >
                  <Copy className="w-3 h-3" /> {t("copy")}
                </button>
              </div>
              <p className="text-xs text-foreground/90 whitespace-pre-line break-keep leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 break-keep">{t("compliance")}</p>
    </section>
  );
}
