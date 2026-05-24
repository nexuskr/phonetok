import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, User as UserIcon } from "lucide-react";

export default function Account() {
  const nav = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <UserIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">내 계정</h1>
      </header>

      <section className="rounded-2xl bg-card border border-border p-6 space-y-2">
        <div className="text-xs text-muted-foreground">로그인 이메일</div>
        <div className="font-bold">{email ?? "로그인되지 않음"}</div>
      </section>

      <button
        onClick={logout}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-border hover:bg-muted font-bold"
      >
        <LogOut className="h-5 w-5" /> 로그아웃
      </button>
    </main>
  );
}
