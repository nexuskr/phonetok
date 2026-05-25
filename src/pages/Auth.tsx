import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { notify } from "@/lib/notify";

type Mode = "signin" | "signup";

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState(params.get("ref") ?? "");
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
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        notify.success("가입 완료", "이메일 인증을 확인해주세요");
        if (refCode.trim().length === 8) {
          try { await supabase.rpc("apply_referral_code", { _code: refCode.trim().toUpperCase() }); } catch { /* */ }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/home", { replace: true });
      }
    } catch (err) {
      notify.error("인증 실패", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) nav("/home", { replace: true });
    } catch (err) {
      notify.error("Google 로그인 실패", err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[image:var(--gradient-bg)] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md space-y-7"
      >
        <header className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-black tracking-tight text-primary">
            <Sparkles className="h-7 w-7" /> PHONARA
          </Link>
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "다시 오신 걸 환영합니다" : "3초 안에 시작하세요"}
          </h1>
          {mode === "signup" && (
            <p className="text-sm text-primary">가입 즉시 10,000 PHON 보너스</p>
          )}
        </header>

        <button
          onClick={google}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google로 {mode === "signin" ? "로그인" : "가입"}
        </button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> 또는 이메일 <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border focus-within:border-primary transition">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일" className="flex-1 bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border focus-within:border-primary transition">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)" className="flex-1 bg-transparent outline-none"
            />
          </label>
          {mode === "signup" && (
            <input
              type="text" maxLength={8} value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="추천 코드 (선택)"
              className="w-full px-4 py-3 rounded-2xl bg-card border border-border focus:border-primary outline-none uppercase tracking-widest text-center"
            />
          )}
          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-bold text-lg shadow-[var(--glow-gold)] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "처리 중…" : mode === "signin" ? "로그인" : "무료 가입"}
            {!loading && <ArrowRight className="h-5 w-5" />}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="hover:text-foreground">
            {mode === "signin" ? "처음이신가요? 가입" : "이미 계정 있음 → 로그인"}
          </button>
          <Link to="/auth/forgot" className="hover:text-foreground">비밀번호 찾기</Link>
        </div>
      </motion.div>
    </main>
  );
}
