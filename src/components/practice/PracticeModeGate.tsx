import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { isPracticeMode, setPracticeMode } from "@/lib/practiceMode";
import { Button } from "@/components/ui/button";

/**
 * Practice Mode가 켜져 있으면 자식 컴포넌트 대신 안전 안내 인터스티셜을 표시.
 * 사용자가 명시적으로 "실거래 모드 전환" 버튼을 눌러야 진입 가능.
 */
export function PracticeModeGate({ children, label = "이 화면" }: { children: ReactNode; label?: string }) {
  if (!isPracticeMode()) return <>{children}</>;
  return (
    <div className="container max-w-lg py-12">
      <div className="glass-strong rounded-3xl p-6 sm:p-8 text-center border border-secondary/40">
        <Sparkles className="w-10 h-10 mx-auto text-secondary" />
        <h1 className="mt-3 font-imperial font-black text-xl sm:text-2xl tracking-[0.02em] break-keep">
          Practice Mode 사용 중
        </h1>
        <p className="mt-3 text-sm text-muted-foreground break-keep">
          {label}은 실거래가 필요한 영역입니다. 안전 모드를 종료하고 진입하시겠습니까?
        </p>
        <div className="mt-5 flex gap-2 justify-center">
          <Button onClick={() => setPracticeMode(false)} className="font-imperial tracking-[0.02em]">
            실거래 모드 전환 <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button asChild variant="ghost"><Link to="/dashboard">홈으로</Link></Button>
        </div>
      </div>
    </div>
  );
}

export default PracticeModeGate;
