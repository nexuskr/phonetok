import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Copy, Share2, Check } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Refer() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Ensure ref code exists
  useEffect(() => {
    if (profile && !profile.referral_code) {
      supabase.rpc("gen_referral_code").then(({ data }) => {
        if (data) supabase.rpc("set_referral_code" as never, { _code: data } as never).then(() => {
          qc.invalidateQueries({ queryKey: ["profile"] });
        });
      }).catch(() => { /* */ });
    }
  }, [profile, qc]);

  const stats = useQuery({
    enabled: !!profile?.id,
    queryKey: ["referral_stats", profile?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_referral_stats");
      return data as { invited?: number; rewards?: number } | null;
    },
  });

  const code = profile?.referral_code ?? "—";
  const link = `${window.location.origin}/auth?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      notify.success("초대 링크 복사 완료");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("복사 실패");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "PHONARA — 무료 부수입", text: "가입하면 양쪽 +5,000 PHON. 내 코드: " + code, url: link });
      } catch { /* user cancelled */ }
    } else {
      copy();
    }
  };

  const s = stats.data ?? {};
  const invited = Number((s as { invited?: number }).invited ?? 0);
  const rewards = Number((s as { rewards?: number }).rewards ?? 0);

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      <header className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">친구 초대</h1>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 bg-gradient-to-br from-pink/20 via-card to-primary/15 border border-pink/30 text-center space-y-3"
      >
        <div className="text-xs text-muted-foreground font-bold">내 추천 코드</div>
        <div className="text-5xl font-black tracking-[0.3em] text-primary">{code}</div>
        <div className="text-sm text-muted-foreground">
          친구가 가입하면 <span className="text-primary font-bold">양쪽 +5,000 PHON</span>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={copy}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-card border border-border hover:border-primary/40 active:scale-95 transition">
          {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
          <span className="font-bold">{copied ? "복사됨" : "링크 복사"}</span>
        </button>
        <button onClick={share}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-bold active:scale-95 transition">
          <Share2 className="h-5 w-5" /> 공유하기
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="text-xs text-muted-foreground">초대한 친구</div>
          <div className="text-2xl font-black mt-1">{invited}<span className="text-sm text-muted-foreground"> 명</span></div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="text-xs text-muted-foreground">누적 보상</div>
          <div className="text-2xl font-black mt-1 text-primary">{rewards.toLocaleString()}<span className="text-sm text-muted-foreground"> PHON</span></div>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        💡 <span className="font-semibold text-foreground">팁:</span> 카카오톡 / 인스타그램 DM / 틱톡 댓글에 링크만 붙여넣으세요. 친구가 가입한 즉시 양쪽에 보상이 지급됩니다.
      </div>
    </main>
  );
}
