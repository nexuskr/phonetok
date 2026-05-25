import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Target, Share2, Flame, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { notify } from "@/lib/notify";
import { rewardBurst } from "@/components/feedback/RewardBurst";
import CountUp from "@/components/feedback/CountUp";

const SEEN_KEY = "phonara:onboarded:v2";

export default function OnboardingGate() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user || !profile) return;
    const seenLocal = localStorage.getItem(SEEN_KEY) === "1";
    if (profile.has_seen_guide || seenLocal) return;
    setOpen(true);
  }, [user, profile]);

  if (!open) return null;

  const finish = async () => {
    localStorage.setItem(SEEN_KEY, "1");
    try {
      await supabase.from("profiles").update({ has_seen_guide: true }).eq("id", user!.id);
    } catch { /* trigger guards may block — local flag is enough */ }
    setOpen(false);
  };

  const next = () => setStep((s) => Math.min(3, s + 1));

  const steps = [
    {
      icon: Gift, color: "from-primary to-primary-glow",
      title: "환영 보너스",
      sub: "지금 가입하면 즉시 지급",
      body: <div className="text-5xl font-black text-primary"><CountUp value={10000} duration={1200} /> <span className="text-2xl">PHON</span></div>,
      cta: "보너스 받기",
      action: async () => {
        try { await supabase.rpc("imperial_claim_signup_bonus"); } catch { /* may already claimed */ }
        rewardBurst();
        notify.reward(10000);
        next();
      },
    },
    {
      icon: Target, color: "from-pink to-primary",
      title: "첫 미션",
      sub: "탭 한 번이면 끝납니다",
      body: <p className="text-muted-foreground">간단한 무료 미션으로 추가 보상을 받아보세요.</p>,
      cta: "미션 수령",
      action: async () => {
        try { await supabase.rpc("claim_free_mission", { _code: "welcome_tap" }); } catch { /* idempotent */ }
        notify.reward(500);
        next();
      },
    },
    {
      icon: Share2, color: "from-secondary to-primary",
      title: "친구 초대",
      sub: "친구가 가입하면 양쪽 +5,000 PHON",
      body: profile?.referral_code ? (
        <div className="rounded-2xl bg-muted/50 px-6 py-4 text-2xl font-black tracking-widest text-primary">{profile.referral_code}</div>
      ) : <p className="text-muted-foreground">곧 추천 코드가 발급됩니다.</p>,
      cta: "코드 복사하고 다음",
      action: async () => {
        if (profile?.referral_code) {
          try { await navigator.clipboard.writeText(profile.referral_code); notify.success("코드 복사 완료"); } catch { /* */ }
        }
        next();
      },
    },
    {
      icon: Flame, color: "from-destructive to-primary",
      title: "매일 출석",
      sub: "연속 출석 보상 + 7일마다 1배 보너스",
      body: <div className="text-6xl">🔥</div>,
      cta: "출석 시작",
      action: async () => {
        try { await supabase.rpc("claim_daily_attendance_v2"); rewardBurst(); notify.reward(5000); } catch { /* */ }
        finish();
      },
    },
  ];

  const cur = steps[step];
  const Icon = cur.icon;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <button
          onClick={finish}
          className="absolute top-4 right-4 p-2 rounded-full bg-muted/50 text-muted-foreground hover:text-foreground"
          aria-label="건너뛰기"
        >
          <X className="h-5 w-5" />
        </button>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md space-y-6 text-center"
        >
          <div className={`mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br ${cur.color} grid place-items-center shadow-[var(--glow-gold)]`}>
            <Icon className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-3xl font-black">{cur.title}</h2>
            <p className="text-muted-foreground mt-1">{cur.sub}</p>
          </div>
          <div className="py-6">{cur.body}</div>

          <div className="flex justify-center gap-1.5 pt-2">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-muted"}`} />
            ))}
          </div>

          <button
            onClick={cur.action}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-bold text-lg shadow-[var(--glow-gold)] active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {cur.cta} <ArrowRight className="h-5 w-5" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
