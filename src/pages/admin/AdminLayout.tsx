import { NavLink, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Coins, ArrowUpFromLine, Flag } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-user-role";

const NAV = [
  { to: "/admin",            label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/admin/users",      label: "유저 관리", icon: Users },
  { to: "/admin/balances",   label: "잔고 조정", icon: Coins },
  { to: "/admin/withdrawals", label: "출금 승인", icon: ArrowUpFromLine },
  { to: "/admin/reports",    label: "신고 모니터링", icon: Flag },
];

export default function AdminLayout() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (isLoading) return <div className="p-8 text-muted-foreground">권한 확인 중…</div>;
  if (!isAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card">
        <div className="p-5 font-black text-primary">PHONARA · ADMIN</div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile top tabs */}
      <nav className="md:hidden fixed top-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-b border-border overflow-x-auto">
        <div className="flex gap-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                }`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto pt-14 md:pt-0 p-5">
        <Outlet />
      </main>
    </div>
  );
}
