import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "neon" | "magenta" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  pulse?: boolean;
}

const sizes = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
  xl: "h-16 px-9 text-lg",
};

export const NeonButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "neon", size = "md", pulse, children, ...rest }, ref) => {
    const variantCls = {
      neon: "apex-gradient text-background apex-glow-neon hover:brightness-110",
      magenta: "bg-gradient-to-r from-accent via-accent/90 to-accent text-accent-foreground apex-glow-magenta hover:brightness-110",
      ghost: "border-2 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary",
    }[variant];
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-wider transition-all overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]",
          sizes[size], variantCls, pulse && "apex-pulse", className,
        )}
        {...rest}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>
        {variant !== "ghost" && (
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        )}
      </button>
    );
  },
);
NeonButton.displayName = "NeonButton";
