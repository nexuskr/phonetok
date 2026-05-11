/**
 * Reviewer Mode 시각적 배지.
 *
 * `?reviewer=1` 또는 localStorage 플래그가 켜진 경우 화면 상단 고정 배너 표시.
 * - 어떤 용어가 마스킹되는지 사용자에게 명확히 안내
 * - X 버튼으로 Reviewer Mode 해제 (localStorage clear)
 */
import { useState } from "react";
import { useReviewerMode } from "@/lib/reviewerMode";
import { ShieldCheck, X, Info } from "lucide-react";

export default function ReviewerBadge() {
  const active = useReviewerMode();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!active || dismissed) return null;

  return (
    <div
      data-no-mask="true"
      className="fixed top-0 inset-x-0 z-[60] pointer-events-none flex justify-center pt-[max(env(safe-area-inset-top),0px)]"
    >
      <div className="pointer-events-auto m-2 px-3 py-1.5 rounded-full bg-emerald-600/95 text-white text-[11px] font-bold tracking-wide shadow-lg flex items-center gap-2 backdrop-blur">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>REVIEWER MODE</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-0.5 hover:bg-white/20 transition"
          aria-label="Reviewer Mode 안내"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("phonara_reviewer_mode");
            } catch {}
            setDismissed(true);
            // soft refresh URL (remove ?reviewer=1)
            const url = new URL(window.location.href);
            url.searchParams.delete("reviewer");
            window.history.replaceState({}, "", url.toString());
            window.location.reload();
          }}
          className="rounded-full p-0.5 hover:bg-white/20 transition"
          aria-label="Reviewer Mode 종료"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div
          data-no-mask="true"
          className="pointer-events-auto absolute top-12 mx-3 max-w-md rounded-2xl bg-background border border-emerald-500/40 shadow-2xl p-4 text-xs leading-relaxed text-foreground"
        >
          <div className="font-bold text-emerald-500 mb-2">Reviewer Mode 안내</div>
          <p className="text-muted-foreground mb-2">
            앱 심사용 안전 모드입니다. 다음 용어가 자동으로 중립적인 표현으로 마스킹되어
            표시됩니다:
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>• 룰렛 → 시뮬레이션 챌린지</li>
            <li>• 잭팟 / Jackpot → 시즌 리워드</li>
            <li>• 대박 → 큰 보상</li>
            <li>• Conquest → Expansion · Raid → Quest</li>
            <li>• Near Miss → Close Try · Recovery → Comeback</li>
          </ul>
          <p className="mt-2 text-muted-foreground/80">
            입력란·코드 블록은 영향 없으며, 데이터 자체는 변경되지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
