import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts type=recovery in hash; once mounted, session should be available
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Wait a tick for hash parsing
        const t = setTimeout(() => supabase.auth.getSession().then(({ data: d2 }) => {
          if (d2.session) setReady(true);
          else toast({ title: "유효하지 않은 링크", description: "재설정 메일을 다시 요청해주세요.", variant: "destructive" });
        }), 600);
        return () => clearTimeout(t);
      }
    });
  }, []);

  async function submit() {
    if (password.length < 8) { toast({ title: "비밀번호는 8자 이상", variant: "destructive" }); return; }
    if (password !== confirm) { toast({ title: "비밀번호가 일치하지 않습니다", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "✅ 비밀번호가 변경되었습니다" });
      nav("/dashboard");
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-primary/25 blur-3xl blob" />

      <div className="relative w-full max-w-md glass-strong neon-border rounded-3xl p-7">
        <h1 className="font-display font-black text-2xl text-gradient-primary">새 비밀번호 설정</h1>
        <p className="text-xs text-muted-foreground mt-1">8자 이상의 새 비밀번호를 입력해주세요.</p>

        <div className="space-y-3 mt-5">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl glass border border-border/40 focus-within:border-primary">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="새 비밀번호"
              className="bg-transparent w-full focus:outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl glass border border-border/40 focus-within:border-primary">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="비밀번호 확인"
              className="bg-transparent w-full focus:outline-none text-sm" />
          </div>
        </div>

        <button onClick={submit} disabled={busy || !ready}
          className="mt-5 w-full py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-bold glow-primary hover:scale-[1.02] transition disabled:opacity-50">
          {busy ? "변경 중..." : ready ? "비밀번호 변경" : "링크 검증 중..."}
        </button>
      </div>
    </div>
  );
}
