/**
 * /security/recover — 인증 앱 분실 시 백업 코드 입력 페이지
 * 비밀번호로 로그인된(AAL1) 관리자가 호출 → TOTP factor 삭제 → /security/totp 로 이동
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";

export default function RecoverTotp() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("consume_admin_backup_code" as any, {
      _code: code.trim(),
    });
    setBusy(false);
    if (error) {
      notify.error(
        error.message?.includes("admin_only")
          ? "관리자 권한이 없습니다."
          : error.message?.includes("invalid_code")
          ? "유효하지 않은 코드입니다. (다른 관리자에게 4-Eyes 복구를 요청하세요.)"
          : `실패: ${error.message}`
      );
      return;
    }
    notify.success(
      `TOTP factor가 삭제되었습니다 (${(data as any)?.totp_removed ?? 0}개). 새 인증 앱을 등록하세요.`
    );
    setTimeout(() => nav("/security/totp"), 800);
  };

  return (
    <div className="container mx-auto max-w-md py-12 px-4">
      <div className="glass-strong rounded-3xl p-6 border border-border/40 space-y-5">
        <header className="text-center space-y-2">
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
          <h1 className="font-display font-black text-xl">관리자 인증 앱 복구</h1>
          <p className="text-xs text-muted-foreground break-keep">
            인증 앱(TOTP)을 분실하셨나요? 사전에 발급받은 <b>백업 코드 1개</b>를 입력하면 기존
            인증 앱이 해제되고 새로 등록할 수 있습니다.
          </p>
        </header>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> 백업 코드 (10자)
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XX"
            className="font-mono text-base tracking-widest text-center"
            autoFocus
          />
        </div>

        <Button className="w-full" onClick={submit} disabled={busy || !code.trim()}>
          {busy ? "확인 중…" : "복구하기"}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>

        <div className="text-[11px] text-muted-foreground text-center space-y-1 border-t border-border/40 pt-3">
          <p>코드를 분실하셨나요?</p>
          <p>
            다른 관리자에게{" "}
            <Link to="/admin/ops/recovery" className="text-primary underline">
              4-Eyes 복구 요청
            </Link>
            을 부탁하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
