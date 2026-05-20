import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Vault, Film } from "lucide-react";

/**
 * ApexEntryCardMobile — 홈 Hero 직후 모바일 전용 대형 진입 카드.
 * - 22px 제목 + 16.5px 부제
 * - 64px 높이 풀폭 CTA (Gold→Neon Red gradient)
 * - 미니 KPI 3개 (정적 — money-flow 미터치, 표시용)
 */
function ApexEntryCardMobileInner() {
  return (
    <section className="md:hidden px-4 mt-6 mb-2">
      <div
        className="
          relative overflow-hidden rounded-3xl
          border border-amber-400/40
          bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-amber-700/15
          p-5
          shadow-[0_8px_32px_-8px_hsl(38_92%_60%/0.4)]
        "
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-400/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black tracking-[0.18em]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            APEXFORGE LIVE
          </div>

          <h2 className="mt-3 text-[22px] font-black leading-tight text-foreground">
            🔥 무료 돈벌기 시작
          </h2>
          <p className="mt-1 text-[16.5px] text-muted-foreground leading-snug">
            매일 보상 + 빅윈 릴 + 황제 컵<br />지금 입장하면 가입 즉시 ₩5,000
          </p>

          {/* mini KPI row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Vault,  label: "오늘 금고", value: "₩1.2억" },
              { icon: Flame,  label: "Cup 진행",  value: "78%" },
              { icon: Film,   label: "활성 황제", value: "1,840" },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl bg-background/60 ring-1 ring-amber-300/20 px-2 py-2 text-center"
              >
                <k.icon aria-hidden className="w-4 h-4 text-amber-300 mx-auto" />
                <div className="text-[10px] text-muted-foreground mt-1 leading-none">{k.label}</div>
                <div className="text-[13px] font-black text-foreground mt-1 leading-none tabular-nums">{k.value}</div>
              </div>
            ))}
          </div>

          <Link
            to="/apex"
            aria-label="에이펙스 입장"
            className="
              mt-4 w-full h-16 rounded-2xl
              flex items-center justify-center gap-2
              bg-gradient-to-r from-amber-300 via-amber-400 to-rose-500
              text-black text-[18px] font-black tracking-tight
              shadow-[0_8px_24px_-4px_hsl(38_92%_60%/0.55)]
              ring-2 ring-amber-200/70
              transition-transform duration-150 motion-reduce:transition-none
              active:scale-[0.98]
            "
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            🚀 에이펙스 입장
            <ArrowRight className="w-5 h-5" strokeWidth={2.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export const ApexEntryCardMobile = memo(ApexEntryCardMobileInner);
export default ApexEntryCardMobile;
