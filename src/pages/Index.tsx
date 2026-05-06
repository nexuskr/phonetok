import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, TrendingUp, Globe, Cpu, Flame } from "lucide-react";

import { useEffect, useState } from "react";
import Particles from "@/components/Particles";
import { useOnline, useTotalPayout, useTodayPayout, useMembers } from "@/components/LiveStats";

/* =========================
   🔥 2026 배경 레이어
========================= */

function BackgroundFX() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,80,0,0.15),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(140,0,255,0.15),transparent_40%)]" />
      <div className="absolute inset-0 backdrop-blur-[80px]" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.04]" />
    </>
  );
}

/* =========================
   💰 숫자 증가 애니메이션
========================= */

function useCountUp(target: number) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => prev + Math.floor(Math.random() * 5000));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return value;
}

/* =========================
   🧠 리얼 채팅 엔진 (사람처럼)
========================= */

const users = [
  "민준",
  "서연",
  "지훈",
  "유진",
  "도윤",
  "하은",
  "태현",
  "지민",
  "현우",
  "수아",
  "지영",
  "승현",
  "나연",
  "재훈",
  "은지",
  "태리",
];

const templates = [
  (u: string) => `${u}님 미션 완료 (+₩${rand()})`,
  (u: string) => `${u}님 출금 완료 (+₩${rand()})`,
  (u: string) => `${u}님 VIP 달성`,
  (u: string) => `${u}: 이거 진짜 되네`,
  (u: string) => `${u}: 방금 입금됨`,
  (u: string) => `${u}: 꾸준히 하면 쌓임`,
];

function rand() {
  return (Math.floor(Math.random() * 50000) + 1000).toLocaleString();
}

function LiveChat() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const loop = () => {
      setTimeout(
        () => {
          const user = users[Math.floor(Math.random() * users.length)];
          const template = templates[Math.floor(Math.random() * templates.length)];
          const msg = template(user);

          setMessages((prev) => [msg, ...prev].slice(0, 8));
          loop();
        },
        800 + Math.random() * 2000,
      );
    };
    loop();
  }, []);

  return (
    <div className="rounded-2xl p-5 border border-white/10 bg-white/5 backdrop-blur-xl w-full max-w-md">
      <div className="text-xs mb-3 flex items-center gap-2 text-orange-400">
        <Flame className="w-4 h-4" /> 실시간 활동
      </div>

      <div className="space-y-2 text-sm">
        {messages.map((m, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-white/5">
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   💣 VIP 압박 UX
========================= */

function VipPressure() {
  const [left, setLeft] = useState(7);

  useEffect(() => {
    const interval = setInterval(() => {
      setLeft((prev) => (prev > 1 ? prev - (Math.random() > 0.7 ? 1 : 0) : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return <div className="mt-6 text-xs text-orange-400">⚠ VIP 좌석 {left}개 남음</div>;
}

/* =========================
   🚀 MAIN
========================= */

export default function Index() {
  const online = useOnline();
  const total = useTotalPayout();
  const today = useTodayPayout();
  const members = useMembers();

  const animatedTotal = useCountUp(total);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* 배경 */}
      <BackgroundFX />

      {/* particles → 헤더 아래만 */}
      <div className="absolute inset-0 top-20 pointer-events-none">
        <Particles density={40} />
      </div>

      {/* 헤더 */}
      <header className="relative z-20">
        <div className="max-w-6xl mx-auto flex justify-between items-center h-16 px-4">
          <div className="font-bold text-lg text-orange-400">PHONEMISSION</div>

          <div className="flex gap-3 items-center">
            <Link to="/auth" className="text-sm opacity-70">
              로그인
            </Link>

            <Link to="/auth?signup=1" className="px-4 py-2 rounded-full bg-orange-500 text-sm font-semibold">
              시작하기
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-16 pb-24 text-center">
        <h1 className="text-4xl sm:text-6xl font-black leading-tight">
          폰 하나로 시작하는
          <br />
          <span className="text-orange-500">스마트 수익 시스템</span>
        </h1>

        <p className="mt-6 text-gray-400">자동 미션 + 실시간 정산</p>

        {/* 수익 카드 */}
        <div className="mt-10 flex justify-center">
          <div className="rounded-2xl p-6 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10">
            <div className="text-xs text-gray-400">누적 지급액</div>

            <div className="text-3xl font-bold mt-2 text-orange-500">₩ {animatedTotal.toLocaleString()}</div>

            <div className="text-xs text-green-400 mt-1">+₩ {today.toLocaleString()}</div>

            <div className="text-xs mt-1 text-gray-400">{online.toLocaleString()}명 접속 중</div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Link
            to="/auth?signup=1"
            className="px-8 py-4 rounded-full bg-orange-500 font-bold inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            무료 시작하기
            <ArrowRight className="w-5 h-5" />
          </Link>

          <VipPressure />
        </div>

        {/* 채팅 */}
        <div className="mt-12 flex justify-center">
          <LiveChat />
        </div>
      </section>

      {/* 기능 */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
            <Cpu className="mx-auto mb-2" />
            AI 자동 미션
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
            <TrendingUp className="mx-auto mb-2" />
            수익 증가 시스템
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
            <Globe className="mx-auto mb-2" />
            실시간 글로벌 정산
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="relative z-10 text-center pb-24">
        <div className="text-3xl font-bold text-orange-500">{members.toLocaleString()}</div>
        <div className="text-sm text-gray-400">활성 사용자</div>
      </section>

      {/* CTA */}
      <section className="text-center pb-20">
        <h2 className="text-3xl font-bold">지금 시작하세요</h2>

        <Link to="/auth?signup=1" className="mt-6 inline-block px-10 py-4 bg-orange-500 rounded-full">
          무료 시작
        </Link>
      </section>
    </div>
  );
}
