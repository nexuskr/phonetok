/**
 * WalletTopSection — Sprint 2 composition mounted at top of /wallet.
 * Bundles Dashboard + WithdrawCard + WithdrawModal + WithdrawHistory.
 */
import WalletDashboard from "./WalletDashboard";
import WithdrawCard from "./WithdrawCard";
import WithdrawModal from "./WithdrawModal";
import WithdrawHistory from "./WithdrawHistory";
import { useWalletSnapshot } from "../hooks/useWalletSnapshot";
import { useWithdraw } from "../hooks/useWithdraw";

export default function WalletTopSection() {
  const snap = useWalletSnapshot();
  const ctl = useWithdraw({
    available: snap.available,
    minWithdraw: snap.minWithdraw,
    onSuccess: () => { void snap.reload(); },
  });

  return (
    <div className="space-y-4 mb-6">
      <WalletDashboard />
      <WithdrawCard onClick={ctl.openModal} disabled={snap.available < snap.minWithdraw} />
      <WithdrawHistory />
      <WithdrawModal available={snap.available} minWithdraw={snap.minWithdraw} ctl={ctl} />
    </div>
  );
}
