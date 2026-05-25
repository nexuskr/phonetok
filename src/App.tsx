import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import MobileBottomNav from "@/components/nav/MobileBottomNav";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import OnboardingGate from "@/components/onboarding/OnboardingGate";

import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

const Home    = lazy(() => import("@/pages/Home"));
const Wallet  = lazy(() => import("@/pages/Wallet"));
const Trade   = lazy(() => import("@/pages/Trade"));
const Slots   = lazy(() => import("@/pages/Slots"));
const Refer   = lazy(() => import("@/pages/Refer"));
const Account = lazy(() => import("@/pages/Account"));

const AdminLayout      = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard   = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers       = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminBalances    = lazy(() => import("@/pages/admin/AdminBalances"));
const AdminWithdrawals = lazy(() => import("@/pages/admin/AdminWithdrawals"));
const AdminReports     = lazy(() => import("@/pages/admin/AdminReports"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const Loader = () => (
  <div className="min-h-[40vh] grid place-items-center text-muted-foreground text-sm">불러오는 중…</div>
);

const Guard = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Suspense fallback={<Loader />}>{children}</Suspense>
  </ProtectedRoute>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground" style={{ paddingBottom: "var(--bottom-nav-h)" }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/forgot" element={<ForgotPassword />} />
            <Route path="/auth/reset" element={<ResetPassword />} />

            <Route path="/home"    element={<Guard><Home /></Guard>} />
            <Route path="/wallet"  element={<Guard><Wallet /></Guard>} />
            <Route path="/trade"   element={<Guard><Trade /></Guard>} />
            <Route path="/slots"   element={<Guard><Slots /></Guard>} />
            <Route path="/refer"   element={<Guard><Refer /></Guard>} />
            <Route path="/account" element={<Guard><Account /></Guard>} />

            <Route path="/admin" element={<Guard><AdminLayout /></Guard>}>
              <Route index             element={<Suspense fallback={<Loader />}><AdminDashboard /></Suspense>} />
              <Route path="users"      element={<Suspense fallback={<Loader />}><AdminUsers /></Suspense>} />
              <Route path="balances"   element={<Suspense fallback={<Loader />}><AdminBalances /></Suspense>} />
              <Route path="withdrawals" element={<Suspense fallback={<Loader />}><AdminWithdrawals /></Suspense>} />
              <Route path="reports"    element={<Suspense fallback={<Loader />}><AdminReports /></Suspense>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileBottomNav />
          <OnboardingGate />
        </div>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
