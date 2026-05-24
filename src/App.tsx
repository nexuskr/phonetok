import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import MobileBottomNav from "@/components/nav/MobileBottomNav";

import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import Wallet from "@/pages/Wallet";
import Trade from "@/pages/Trade";
import Slots from "@/pages/Slots";
import Refer from "@/pages/Refer";
import Account from "@/pages/Account";
import NotFound from "@/pages/NotFound";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminBalances from "@/pages/admin/AdminBalances";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminReports from "@/pages/admin/AdminReports";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground pb-20">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="/home" element={<Home />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/slots" element={<Slots />} />
          <Route path="/refer" element={<Refer />} />
          <Route path="/account" element={<Account />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="balances" element={<AdminBalances />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <MobileBottomNav />
      </div>
      <Toaster />
    </BrowserRouter>
  );
}
