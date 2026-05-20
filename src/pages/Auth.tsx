import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { verifySessionOnce } from "@/lib/auth/authSingleFlight";

/**
 * P0-3: 이미 인증된 사용자가 /auth 진입 시 dashboard 로 리다이렉트.
 * 미인증이면 /secure-auth 로 위임 (기존 동작).
 */
export default function Auth() {
  const [params] = useSearchParams();
  const qs = params.toString();
  const [decided, setDecided] = useState<"login" | "authed" | null>(null);

  useEffect(() => {
    let alive = true;
    verifySessionOnce()
      .then((user) => { if (alive) setDecided(user ? "authed" : "login"); })
      .catch(() => { if (alive) setDecided("login"); });
    return () => { alive = false; };
  }, []);

  if (decided === null) return null; // 즉시 라우팅 — 깜빡임 최소
  if (decided === "authed") return <Navigate to="/dashboard" replace />;
  return <Navigate to={`/secure-auth${qs ? `?${qs}` : ""}`} replace />;
}
