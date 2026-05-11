import { Link } from "react-router-dom";
import { Flame, ArrowRight, Crown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import DepositCTA from "@/components/onboarding/DepositCTA";
import { GoldNebulaBg, ParticleField, senior } from "./EmpireFX";

/**
 * Phase 4 / 영화급 — 씬7 FINAL CTA.
 * 거대한 골드 neon pulse 1탭 입금 + 보조 패키지 링크.
 */
export default function FomoFinalCTA({ large = false }: { large?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <section
      data-large={large}
      className="snap-start snap-always min-h-[calc(100dvh-56px)] flex flex-col justify-center relative overflow-hidden px-5 py-12"
    >
      <GoldNebulaBg tone="gold" />
      <ParticleField density={22} />

      <div className="relative max-w-md mx-auto w-full text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass border border-gold/60 text-[10px] font-black tracking-[0.3em] text-gold mb-5 shadow-[0_0_16px_hsl(var(--gold)/0.35)]"
        >
          <Crown className="w-3 h-3" /> 마지막 한 걸음
        </motion.div>

        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`font-imperial text-4xl sm:text-5xl leading-[1.1] break-keep mb-3 ${senior.h1}`}
        >
          지금,<br />
          <span className="text-gradient-gold drop-shadow-[0_0_24px_hsl(var(--gold)/0.6)]">제국에 입성하십시오</span>
        </motion.h2>

        <p className={`text-sm text-muted-foreground mb-7 break-keep ${senior.body}`}>
          50,000원 한 번이면 모든 미션이 자동 완료됩니다.<br />
          평균 출금 23분 · 19+ 본인인증 · 운영자 무손실 인장.
        </p>

        {/* 거대한 50,000원 1탭 버튼 (DepositCTA 위에 골드 neon pulse ring) */}
        <div className="relative">
          {!reduce && (
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-gold pointer-events-none"
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.05, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <DepositCTA size="lg" />
        </div>

        <Link
          to="/packages?focus=easy_starter"
          className={`press mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl glass-strong border border-gold/30 text-sm font-bold hover:border-gold/60 transition ${senior.btn}`}
        >
          <Flame className="w-4 h-4 text-gold" /> 패키지 전체 보기 <ArrowRight className="w-4 h-4" />
        </Link>

        <div className="mt-7 text-[10px] text-muted-foreground tracking-widest break-keep">
          본 서비스는 미션 보상형 리워드 플랫폼이며, 투자/도박이 아닙니다.
        </div>
      </div>
    </section>
  );
}
