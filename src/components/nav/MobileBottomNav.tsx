import { NavLink, useLocation } from "react-router-dom";
import { Home, Wallet, LineChart, Gem, Users } from "lucide-react";

const TABS = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/trade", label: "트레이드", icon: LineChart },
  { to: "/slots", label: "슬롯", icon: Gem },
  { to: "/wallet", label: "지갑", icon: Wallet },
  { to: "/refer", label: "추천", icon: Users },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  // Hide on landing/auth/admin
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return null;
  }
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="모바일 메인 네비게이션"
    >
      <ul className="grid grid-cols-5 h-16">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
