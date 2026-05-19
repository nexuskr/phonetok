import { NavLink, Outlet } from "react-router-dom";
import { ApexThemeProvider } from "./ApexThemeProvider";
import { Home, Gift, Vault, Play, Package, Trophy, User } from "lucide-react";

const TABS = [
  { to: "/apex",          label: "Home",   icon: Home,    end: true },
  { to: "/apex/free",     label: "Free",   icon: Gift },
  { to: "/apex/vault",    label: "Vault",  icon: Vault },
  { to: "/apex/reels",    label: "Reels",  icon: Play },
  { to: "/apex/lootbox",  label: "Loot",   icon: Package },
  { to: "/apex/sports",   label: "Sports", icon: Trophy },
  { to: "/apex/my",       label: "My",     icon: User },
];

export default function ApexShell() {
  return (
    <ApexThemeProvider>
      <div className="relative min-h-screen text-foreground apex-particle-burst">
        <div className="absolute inset-0 apex-grid-bg pointer-events-none" />

        <header className="sticky top-0 z-40 apex-glass border-b border-primary/20">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
            <NavLink to="/apex" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg apex-gradient flex items-center justify-center font-black text-background text-sm">
                A
              </div>
              <div className="leading-none">
                <span className="block text-lg font-black tracking-tight apex-gradient-text">
                  APEXFORGE
                </span>
                <span className="block text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  destroys stake · rollbit · freecash
                </span>
              </div>
            </NavLink>
            <NavLink
              to="/dashboard"
              className="text-[11px] px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition"
            >
              ← Phonara
            </NavLink>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-28 pt-5 animate-fade-in">
          <Outlet />
        </main>

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 inset-x-0 z-40 apex-glass border-t border-primary/20 safe-bottom">
          <ul className="mx-auto max-w-6xl grid grid-cols-7">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                      isActive
                        ? "text-primary apex-text-neon"
                        : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_8px_hsl(var(--apex-neon))]" : ""}`} />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ApexThemeProvider>
  );
}
