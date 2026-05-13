import { useEffect, useState } from "react";
import { useNowTick } from "@/hooks/use-now-tick";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Mail, ShieldCheck, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * 출금 본인확인용 6자리 이메일 OTP. SMS 의존을 제거하고 가입 시 전화번호가
 * 없는 사용자도 사용 가능하도록 한다.
 */
export default function WithdrawOtpDialog({ open, onClose, onVerified }: Props) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!open) {
      setCode("");
      setSentAt(null);
      setSecondsLeft(0);
    }
  }, [open]);

  const _otpTick = useNowTick(1000);
  useEffect(() => {
    if (!sentAt) return;
    setSecondsLeft(Math.max(0, 300 - Math.floor((Date.now() - sentAt) / 1000)));
  }, [sentAt, _otpTick]);

  async function sendOtp() {
    setSending(true);
    try {
      const { error } = await supabase.rpc("request_withdraw_otp" as any);
      if (error) throw error;
      setSentAt(Date.now());
      notify.success("인증 코드를 이메일로 발송했어요", { description: "5분 이내에 입력해주세요." });
    } catch (e: any) {
      const msg = e?.message?.includes("rate_limited")
        ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
        : e?.message ?? "발송에 실패했습니다.";
      notify.error("OTP 발송 실패", { description: msg });
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (code.length !== 6) {
      notify.error("6자리 숫자를 입력해주세요");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.rpc("verify_withdraw_otp" as any, { _code: code });
      if (error) throw error;
      notify.success("본인확인 완료");
      onVerified();
    } catch (e: any) {
      const map: Record<string, string> = {
        invalid_code: "코드가 일치하지 않습니다.",
        no_active_code: "유효한 코드가 없습니다. 다시 발송해주세요.",
        too_many_attempts: "시도 횟수를 초과했습니다. 새 코드를 요청해주세요.",
        invalid_format: "6자리 숫자를 입력해주세요.",
      };
      const key = (e?.message ?? "").trim();
      notify.error("인증 실패", { description: map[key] ?? key });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            출금 본인확인
          </DialogTitle>
          <DialogDescription>
            등록된 이메일로 6자리 인증 코드를 보내드립니다. 코드는 5분간 유효합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button onClick={sendOtp} disabled={sending || (secondsLeft > 240)} className="w-full" variant={sentAt ? "outline" : "default"}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            {sentAt ? `재발송 ${secondsLeft > 240 ? `(${secondsLeft - 240}s)` : "가능"}` : "인증 코드 발송"}
          </Button>

          {sentAt && (
            <>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6자리 코드"
                className="text-center text-2xl tracking-[0.5em] font-bold"
              />
              <div className="text-xs text-muted-foreground text-center">
                남은 시간: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </div>
              <Button onClick={verify} disabled={verifying || code.length !== 6 || secondsLeft === 0} className="w-full">
                {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                확인
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
