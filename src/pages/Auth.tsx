import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/home", { replace: true });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        toast.success("가입 완료 — 이메일을 확인하세요");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("로그인 성공");
        nav("/home", { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "인증 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <Link to="/" className="text-2xl font-black tracking-tight text-primary">
            PHONARA
          </Link>
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "다시 오신 걸 환영합니다" : "무료로 시작하기"}
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-primary outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="비밀번호 (최소 6자)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-primary outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-50"
          >
            {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="hover:text-foreground"
          >
            {mode === "signin" ? "계정이 없으신가요? 가입" : "이미 계정이 있나요? 로그인"}
          </button>
          <Link to="/auth/forgot" className="hover:text-foreground">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </main>
  );
}
