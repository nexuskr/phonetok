/**
 * ⌘K Command Palette — section/page jump powered by cmdk (shadcn).
 * Groups by IA section, marks AAL2 routes, prefetch on hover via NavLink.
 */
import { useEffect, useState, useMemo, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { ADMIN_NAV } from "@/pages/admin/_nav";

function AdminCommandTriggerBase() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (to: string) => {
      setOpen(false);
      // small defer so dialog close animation doesn't fight router transition
      requestAnimationFrame(() => navigate(to));
    },
    [navigate],
  );

  const groups = useMemo(() => ADMIN_NAV, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-background/40 text-xs text-muted-foreground hover:border-primary/60 transition min-w-[200px]"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">검색 / 이동…</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 font-mono">⌘K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden h-9 w-9 rounded-lg border border-border/60 bg-background/40 grid place-items-center"
        aria-label="Search"
      >
        <Search className="w-4 h-4 text-muted-foreground" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="섹션·페이지 검색…" />
        <CommandList>
          <CommandEmpty>결과 없음</CommandEmpty>
          {groups.map((section) => (
            <CommandGroup
              key={section.id}
              heading={`${section.emoji}  ${section.label}${section.aal2 ? "  · AAL2" : ""}`}
            >
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${section.label} ${item.name} ${item.to}`}
                    onSelect={() => go(item.to)}
                  >
                    <Icon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <span>{item.name}</span>
                    {section.aal2 && (
                      <CommandShortcut className="text-[9px] tracking-[0.2em] text-destructive/80 font-black">
                        AAL2
                      </CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default memo(AdminCommandTriggerBase);
