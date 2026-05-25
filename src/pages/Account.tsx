import { useNavigate } from "react-router-dom";
import { User, LogOut, Shield, Bell, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { useIsAdmin } from "@/hooks/use-user-role";
import { notify } from "@/lib/notify";

export default function Account() {
  const nav = useNavigate();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();

  const logout = async () => {
    await supabase.auth.signOut();
    notify.info("로그아웃 완료");
    nav("/", { replace: true });
  };

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      <header className="flex items-center gap-3">
        <User className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">계정</h1>
      </header>

      <section className="rounded-2xl p-5 bg-card border border-border">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-pink grid place-items-center text-2xl text-primary-foreground font-black">
            {profile?.nickname?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black truncate">{profile?.nickname ?? "사용자"}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            <div className="text-xs text-primary mt-0.5">티어 · {profile?.tier ?? "normal"}</div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {[
          { icon: Bell, label: "알림 설정", onClick: () => notify.info("준비 중") },
          { icon: Shield, label: "보안 설정", onClick: () => notify.info("준비 중") },
          { icon: FileText, label: "이용약관 · 개인정보", onClick: () => notify.info("준비 중") },
          ...(isAdmin ? [{ icon: Shield, label: "관리자 대시보드", onClick: () => nav("/admin") }] : []),
        ].map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border hover:border-primary/40 transition text-left">
            <Icon className="h-5 w-5 text-primary" />
            <span className="font-semibold">{label}</span>
          </button>
        ))}
      </section>

      <button onClick={logout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-destructive/15 border border-destructive/40 text-destructive font-bold hover:bg-destructive/25 transition">
        <LogOut className="h-5 w-5" /> 로그아웃
      </button>
    </main>
  );
}
