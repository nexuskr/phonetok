import { useEffect, type ReactNode } from "react";
import "./theme.css";

/**
 * ApexThemeProvider — sets [data-theme="apex"] on <html> while mounted.
 * Restores previous value on unmount so existing Phonara pages stay untouched.
 */
export function ApexThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "apex");
    return () => {
      if (prev === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", prev);
    };
  }, []);
  return <>{children}</>;
}
