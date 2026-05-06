import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const v = z.string().email().safeParse(email.trim());
    if (!v.success) { toast({ title: "올바른 이메일을 입력해주세요", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "📧 메일 발송 완료", description: "비밀번호 재설정 링크를 확인해주세요." });
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-primary/25 blur-3xl blob" />

      <div className="relative w-full max-w-md glass-strong neon-border rounded-3xl p-7">
        <Link to="/secure-auth" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-3 h-3" /> 로그인으로 돌아가기
        </Link>
        <h1 className="font-display font-black text-2xl text-gradient-primary">비밀번호 찾기</h1>
        <p className="text-xs text-muted-foreground mt-1">가입하신 이메일로 재설정 링크를 보내드립니다.</p>

        {sent ? (
          <div className="mt-6 p-4 rounded-xl glass text-sm text-center">
            <p className="text-foreground font-bold">✉️ 메일을 확인해주세요</p>
            <p className="text-xs text-muted-foreground mt-2">받은 메일이 없다면 스팸함을 확인하거나 5분 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl glass border border-border/40 focus-within:border-primary transition">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="가입 이메일"
                className="bg-transparent w-full focus:outline-none text-sm" />
            </div>
            <button onClick={submit} disabled={busy}
              className="mt-4 w-full py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-bold glow-primary hover:scale-[1.02] transition disabled:opacity-50">
              {busy ? "발송 중..." : "재설정 메일 받기"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
