/**
 * WalletTopSection — Sprint 2 + Deposit v1.0 composition mounted at top of /wallet.
 * Bundles Dashboard + Deposit/Withdraw CTA grid + their modals + history lists.
 */
import WalletDashboard from "./WalletDashboard";
import WithdrawCard from "./WithdrawCard";
import WithdrawModal from "./WithdrawModal";
import WithdrawHistory from "./WithdrawHistory";
import DepositCard from "./DepositCard";
import DepositModal from "./DepositModal";
import DepositHistory from "./DepositHistory";
import { useWalletSnapshot } from "../hooks/useWalletSnapshot";
import { useWithdraw } from "../hooks/useWithdraw";
import { useDeposit } from "../hooks/useDeposit";

export default function WalletTopSection() {
  const snap = useWalletSnapshot();
  const wd = useWithdraw({
    available: snap.available,
    minWithdraw: snap.minWithdraw,
    onSuccess: () => { void snap.reload(); },
  });
  const dep = useDeposit({
    onSuccess: () => { void snap.reload(); },
  });

  return (
    <div className="space-y-4 mb-6">
      <WalletDashboard />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DepositCard onClick={dep.openModal} />
        <WithdrawCard onClick={wd.openModal} disabled={snap.available < snap.minWithdraw} />
      </div>
      <DepositHistory />
      <WithdrawHistory />
      <DepositModal ctl={dep} />
      <WithdrawModal available={snap.available} minWithdraw={snap.minWithdraw} ctl={wd} />
    </div>
  );
}
