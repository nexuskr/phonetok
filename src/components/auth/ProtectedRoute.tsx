import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/hooks/use-session";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground text-sm">
        불러오는 중…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
