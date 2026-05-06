import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, TrendingUp, Users, ShieldCheck, Zap, Lock, Heart } from "lucide-react";
import Particles from "@/components/Particles";

export default function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Elegant Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(at_50%_30%,rgba(139,92,246,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(at_20%_70%,rgba(249,115,22,0.12),transparent_60%)]" />

      {/* Soft Aurora Glow Layers */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-900/20 via-transparent to-fuchsia-900/10" />
      <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-[120px]" />
      <div className="absolute -bottom-[30%] -right-[10%] w-[900px] h-[900px] rounded-full bg-gradient-to-br from-orange-500/10 to-transparent blur-[140px]" />

      {/* Subtle Particle Layer */}
      <Particles density={35} className="opacity-60" />

      {/* Top Navigation */}
      <header className="relative z-50 border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-orange-500 to-violet-600 flex items-center justify-center text-white font-black text-xl shadow-xl">
              폰
            </div>
            <span className="font-display font-bold text-2xl tracking-tighter text-white">
              PHONE<span className="text-orange-400">MISSION</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-sm text-zinc-400 hover:text-white transition">
              로그인
            </Link>
            <Link
              to="/auth?signup=1"
              className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 transition-all active:scale-95"
            >
              지금 시작하기
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-40 container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl mb-8">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm text-zinc-400">2026 한국 No.1 사이버 수익 플랫폼</span>
        </div>

        <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tighter text-white">
          폰 하나로 시작하는
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
            진짜 사이버 수익
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
          매일 폰이 돈을 버는 플랫폼.
          <br className="hidden sm:block" />
          AI 미션, 실시간 정산, VIP 패키지로 24시간 자산을 키우세요.
        </p>

        {/* Premium Earnings Card */}
        <div className="mt-14 max-w-lg mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-violet-500/20 blur-3xl -z-10 group-hover:blur-[50px] transition-all duration-700" />

          <div className="glass-strong rounded-3xl p-10 border border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-10" />

            <div className="text-sm text-zinc-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              실시간 누적 정산
            </div>

            <div className="mt-4 text-6xl sm:text-7xl font-display font-black text-white tracking-tighter tabular-nums">
              ₩12,848,008,204
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-emerald-400">
              <TrendingUp className="w-5 h-5" /> 오늘 +₩38,478,317 정산됨
            </div>

            <div className="mt-8 flex justify-center gap-8 text-sm">
              <div>
                <div className="text-white font-semibold">2,839명</div>
                <div className="text-xs text-zinc-500">현재 접속중</div>
              </div>
              <div>
                <div className="text-white font-semibold">99.97%</div>
                <div className="text-xs text-zinc-500">정산 성공률</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/auth?signup=1"
            className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 font-semibold text-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-orange-500/30"
          >
            <Sparkles className="w-6 h-6" />
            무료로 시작하고 5,000원 받기
            <ArrowRight className="group-hover:translate-x-1 transition" />
          </Link>

          <Link to="/auth" className="text-zinc-400 hover:text-white transition">
            이미 회원이신가요?
          </Link>
        </div>

        <div className="mt-6 text-xs text-emerald-400 flex items-center justify-center gap-1">
          <Heart className="w-4 h-4" /> FREE 플랜은 평생 무료 · 결제 압박 0%
        </div>
      </section>

      {/* Trust & Stats */}
      <section className="relative z-30 container mx-auto px-6 py-20">
        <div className="glass-strong rounded-3xl p-8 md:p-12 text-center border border-white/10">
          <div className="text-5xl font-display font-black text-white">
            284,392<span className="text-zinc-500 text-3xl">명</span>
          </div>
          <p className="text-zinc-400 mt-2">2026년 현재 매일 돈을 벌고 있는 회원</p>
        </div>
      </section>

      <div className="h-24" />
    </div>
  );
}
