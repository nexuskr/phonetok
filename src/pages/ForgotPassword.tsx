import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("재설정 메일을 전송했습니다");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
        <input
          type="email"
          required
          placeholder="가입한 이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-card border border-border outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-50"
        >
          {loading ? "전송 중..." : "재설정 메일 보내기"}
        </button>
        <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          ← 로그인으로 돌아가기
        </Link>
      </form>
    </main>
  );
}
