import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  Crown,
  Wallet,
  Trophy,
  LogOut,
  ShieldCheck,
  MessageSquare,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import { useDB } from "@/lib/store";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import FloatingChat from "./FloatingChat";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import TopHUD, { TopHUDCompact } from "./TopHUD";

/**
 * Phonara — Empire 5축 IA
 *
 *  Command  ▶ /command
 *  Earn     ▶ /earn   (mobile: 가운데 골드 FAB)
 *  Empire   ▶ /empire
 *  Treasury ▶ /treasury
 *  Legacy   ▶ /legacy
 */

type NavItem = {
  to: string;
  matches: string[];        // 활성으로 인정되는 경로 prefix들 (구 라우트 호환)
  icon: typeof LayoutDashboard;
  label: string;
  fab?: boolean;            // 모바일 가운데 FAB 강조
};

const NAV: NavItem[] = [
  { to: "/command",  matches: ["/command", "/dashboard"],                                                    icon: LayoutDashboard, label: "Command" },
  { to: "/empire",   matches: ["/empire", "/packages"],                                                       icon: Crown,           label: "Empire" },
  { to: "/earn",     matches: ["/earn", "/missions", "/quests", "/roulette", "/season-pass"],                 icon: Zap,             label: "Earn", fab: true },
  { to: "/treasury", matches: ["/treasury", "/wallet", "/secure-wallet"],                                     icon: Wallet,          label: "Treasury" },
  { to: "/legacy",   matches: ["/legacy", "/achievements"],                                                   icon: Trophy,          label: "Legacy" },
];

const SIDE_EXTRA = [
  { to: "/support", icon: MessageSquare, label: "Support" },
  { to: "/profile", icon: UserIcon,      label: "MY" },
];

function isActive(item: NavItem, pathname: string) {
  return item.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useDB();
  const nav = useNavigate();
  const loc = useLocation();
  const user = db.user;

  useUserNotifications(user?.id);
  useAdminNotifications(!!user?.isAdmin);

  return (
    <div className="min-h-screen md:pl-60 pb-28 md:pb-6">
      {/* Desktop sidebar */}
      {user && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-60 flex-col glass-strong border-r border-primary/10">
          <div className="px-5 py-5 border-b border-border/40">
            <Link to="/command" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-imperial glow-imperial flex items-center justify-center font-imperial font-black text-primary-foreground text-base">
                P
              </div>
              <span className="font-imperial text-base text-gradient-imperial tracking-[0.22em]">
                PHONARA
              </span>
            </Link>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item, loc.pathname);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition press ${
                    active
                      ? "bg-gradient-imperial text-primary-foreground glow-imperial"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </NavLink>
              );
            })}
            <div className="my-3 border-t border-border/40" />
            {SIDE_EXTRA.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            {user.isAdmin && (
              <NavLink
                to="/admin"
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>관리자</span>
              </NavLink>
            )}
          </nav>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setDb((d) => ({ ...d, user: null }));
              nav("/");
            }}
            className="m-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs glass hover:bg-muted/40 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> 로그아웃
          </button>
        </aside>
      )}

      {/* Top bar (mobile + desktop HUD) */}
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="container flex items-center justify-between h-14 md:h-16">
          {/* Mobile brand */}
          <Link to={user ? "/command" : "/"} className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-imperial flex items-center justify-center font-imperial font-black text-primary-foreground text-sm">
              P
            </div>
            <span className="font-imperial text-sm text-gradient-imperial tracking-[0.18em]">
              PHONARA
            </span>
          </Link>
          {/* Desktop: page title spacer */}
          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            <TopHUD />
            <TopHUDCompact />
            {!user && (
              <Link
                to="/secure-auth"
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-imperial text-primary-foreground glow-imperial"
              >
                Enter
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative">{children}</main>

      {/* Mobile bottom nav — 5 tabs with center FAB */}
      {user && (
        <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-md">
          <div className="glass-strong rounded-2xl px-2 py-2 flex items-end justify-between shadow-2xl neon-border relative overflow-visible">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item, loc.pathname);

              if (item.fab) {
                return (
                  <NavLink key={item.to} to={item.to} className="relative -mt-7 flex-1 flex justify-center">
                    <div
                      className={`relative w-16 h-16 rounded-full bg-gradient-imperial flex items-center justify-center shadow-2xl press ${
                        active ? "glow-imperial" : ""
                      }`}
                    >
                      <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-ring-pulse -z-10" />
                      <Icon className="w-7 h-7 text-primary-foreground" />
                      <span className="absolute -bottom-5 text-[10px] font-imperial tracking-[0.2em] text-primary">
                        {item.label.toUpperCase()}
                      </span>
                    </div>
                  </NavLink>
                );
              }

              return (
                <NavLink key={item.to} to={item.to} className="flex-1 press">
                  <div
                    className={`relative flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all duration-300 ${
                      active ? "bg-primary/10" : ""
                    }`}
                  >
                    {active && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-7 h-1 rounded-full bg-gradient-imperial glow-imperial" />
                    )}
                    <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span
                      className={`text-[10px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {item.label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {user && <FloatingChat />}
    </div>
  );
}
