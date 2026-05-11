import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Users, ChevronDown, Shield } from "lucide-react";
import { useOnline } from "@/components/LiveStats";
import { GoldNebulaBg, ParticleField, AnimatedCounter, SimBadge, senior } from "./EmpireFX";

/**
 * Phase 4 / 영화급 — 씬1 HERO
 * 대형 골드 타이틀 · 실시간 SIM 카운터 · Magic Link 최우선 CTA.
 */
export default function FomoScrollHero({
  isLoggedIn = false,
  large = false,
}: { isLoggedIn?: boolean; large?: boolean }) {
  const reduce = useReducedMotion();
  const online = useOnline();
  const seed = online > 0 ? online : 18432;

  return (
    <section
      data-large={large}
      className="snap-start snap-always min-h-[calc(100dvh-56px)] flex flex-col justify-center relative overflow-hidden px-5 py-12"
    >
      <GoldNebulaBg tone="gold" />
      <ParticleField density={16} />

      <div className="relative max-w-md mx-auto w-full text-center">
        {/* LIVE 칩 */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass border border-gold/60 text-[10px] font-black tracking-[0.3em] text-gold mb-5 shadow-[0_0_16px_hsl(var(--gold)/0.35)]"
        >
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-gold animate-ping opacity-60" />
            <span className="relative w-2 h-2 rounded-full bg-gold" />
          </span>
          LIVE · 지금 이 순간
        </motion.div>

        {/* 초대형 골드 타이틀 */}
        <motion.h1
          initial={reduce ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className={`font-imperial text-4xl sm:text-5xl leading-[1.1] break-keep ${senior.h1}`}
        >
          <span className="text-foreground/80 text-2xl sm:text-3xl block mb-2">지금</span>
          <span className="text-gradient-gold drop-shadow-[0_0_24px_hsl(var(--gold)/0.55)]">
            <AnimatedCounter to={seed} duration={2.2} jitter={3} />
            <span className="text-3xl sm:text-4xl">명</span>
          </span>
          <br />
          <span className="text-gradient-imperial">제국에 입성 중</span>
        </motion.h1>

        {/* SIM 라벨 */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-secondary/30 text-xs text-muted-foreground"
        >
          <Users className="w-3.5 h-3.5 text-secondary" />
          실시간 동시접속 <SimBadge />
        </motion.div>

        {/* 보조 카운터: 오늘 누적 출금 */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-6 mx-auto max-w-xs glass-strong rounded-2xl border border-gold/30 px-4 py-3"
        >
          <div className="text-[10px] tracking-[0.3em] font-black text-gold/80 mb-1">오늘 누적 출금</div>
          <div className={`font-imperial text-2xl text-gradient-gold ${senior.h2}`}>
            ₩<AnimatedCounter to={8_241_500_000} duration={2.4} jitter={120_000} format={(v) => v.toLocaleString()} />
          </div>
        </motion.div>

        <p className={`text-sm text-muted-foreground mt-7 break-keep ${senior.body}`}>
          이메일 한 줄이면 시작합니다. 신용카드 없음, 주민번호 없음.
        </p>

        {/* Magic Link 최우선 CTA */}
        <Link
          data-large={large}
          to={isLoggedIn ? "/wallet?intent=first-deposit&tab=deposit&amount=50000" : "/secure-auth?next=/wallet?intent=first-deposit"}
          className={`press sheen mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[64px] rounded-2xl bg-gradient-imperial text-gold-foreground font-display font-black text-lg glow-gold ${senior.btn}`}
        >
          <Flame className="w-5 h-5" /> 1분 안에 제국 입성하기 →
        </Link>

        {!isLoggedIn && (
          <Link to="/secure-auth" className="block mt-3 text-xs text-muted-foreground hover:text-gold transition">
            이미 회원이신가요? 로그인 →
          </Link>
        )}

        {/* trust 미니라인 */}
        <div className="mt-5 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-400" /> 19+ 본인인증</span>
          <span>·</span>
          <span>평균 출금 23분</span>
          <span>·</span>
          <span>OTP 필수</span>
        </div>
      </div>

      {/* SCROLL ↓ */}
      <motion.div
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[10px] font-bold tracking-[0.3em] text-gold/80"
      >
        <span>SCROLL</span>
        <ChevronDown className="w-4 h-4" />
      </motion.div>
    </section>
  );
}
