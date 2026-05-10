import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LuxButton } from "@/components/ui/lux";
import { LoadingList } from "@/components/ui/loading-state";

/**
 * Phase 1 — AdultGate 라우트 래퍼.
 *
 * 보호 라우트 진입 시:
 *  - 비로그인  → /secure-auth 로 이동
 *  - 19+ 미인증 → 모달 노출 + /complete-profile 로 유도 (dismissable=false)
 *  - 19+ 인증 → children 렌더
 *
 * useAdultGate 훅이 글로벌하게 redirect도 해주지만, 본 컴포넌트는
 * 특정 라우트(/packages /wallet /arena 등)에 명시적으로 게이트를 박아 두기 위한 용도.
 * 디자인 시스템 토큰만 사용, 1픽셀도 변경하지 않음.
 */
export function AdultGate({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "blocked" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { nav("/secure-auth", { replace: true }); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_adult,birth_date,profile_completed")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.is_adult) setState("ok");
      else setState("blocked");
    })();
    return () => { cancelled = true; };
  }, [nav]);

  if (state === "loading") return <LoadingList rows={4} />;
  if (state === "blocked") {
    return (
      <Dialog open={true} onOpenChange={() => { /* not dismissable */ }}>
        <DialogContent
          className="max-w-md border-primary/40"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <DialogTitle>만 19세 이상 성인 인증이 필요합니다</DialogTitle>
            </div>
            <DialogDescription className="break-keep">
              본 서비스는 만 19세 이상 성인만 이용 가능합니다. 계속하려면 생년월일을 입력해 주세요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <LuxButton variant="ghost" onClick={() => nav("/", { replace: true })}>나가기</LuxButton>
            <LuxButton onClick={() => nav("/complete-profile", { replace: true })}>
              생년월일 입력하기
            </LuxButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return <>{children}</>;
}

export default AdultGate;
