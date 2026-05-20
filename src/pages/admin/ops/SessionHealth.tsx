// P0-8 — Admin Session Health page (operator chunk)
import SessionHealthCard from "@/components/admin/ops/SessionHealthCard";

export default function SessionHealthPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl">
          Session Health
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Multi-tab auth sync · refresh history · 401 자동복구 · 15s 자동 갱신
        </p>
      </header>
      <SessionHealthCard />
    </div>
  );
}
