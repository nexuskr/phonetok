import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Flame, Users, Wallet, TrendingUp } from "lucide-react";
import LiveTicker from "@/components/feedback/LiveTicker";

const FEATURES = [
  { icon: Flame, title: "매일 출석 보상", desc: "출석만 해도 매일 PHON 지급" },
  { icon: Users, title: "친구 추천", desc: "양쪽 모두 +5,000 PHON" },
  { icon: Wallet, title: "간편 출금", desc: "은행계좌·코인 모두 지원" },
  { icon: TrendingUp, title: "트레이드 / 슬롯", desc: "보너스로 시작" },
];

export default function Index() {
  return (
    <main className="min-h-screen bg-[image:var(--gradient-bg)]">
      <section className="container mx-auto px-6 pt-16 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mx-auto space-y-7"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-bold">
            <Sparkles className="h-4 w-4" /> 무료로 시작하는 부수입 플랫폼
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            매일 들어와서<br />
            <span className="bg-gradient-to-r from-primary via-primary-glow to-pink bg-clip-text text-transparent">무료로</span> 돈 버는 곳
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            출석·미션·친구 추천만으로 시작합니다. 가입 즉시 <span className="text-primary font-bold">10,000 PHON</span> 지급.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-bold text-lg shadow-[var(--glow-gold)] active:scale-95 transition"
            >
              지금 무료 시작 <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/home"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-border bg-card/50 backdrop-blur font-semibold text-lg hover:border-primary transition"
            >
              둘러보기
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="container mx-auto px-6 py-4">
        <LiveTicker />
      </section>

      <section className="container mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }} viewport={{ once: true }}
            className="rounded-2xl bg-card/70 backdrop-blur border border-border p-5"
          >
            <Icon className="h-6 w-6 text-primary" />
            <div className="mt-3 font-bold">{title}</div>
            <div className="text-xs text-muted-foreground mt-1">{desc}</div>
          </motion.div>
        ))}
      </section>
    </main>
  );
}
