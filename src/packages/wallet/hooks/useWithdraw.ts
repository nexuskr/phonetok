/**
 * useWithdraw — Sprint 2 3-step withdraw state machine.
 * Reuses `request_withdrawal` RPC. AAL2/PIN/frozen/OTP handled server-side.
 */
import { useCallback, useState } from "react";
import { requestWithdrawal } from "@/lib/wallet";
import { notify } from "@/lib/notify";
import { g } from "@pkg/core/i18n/glossary";

export type WithdrawMethod = "bank" | "coin";

export interface WithdrawForm {
  amount: string;
  method: WithdrawMethod;
  bankName: string;
  bankAccount: string;
  coinNetwork: "TRC20" | "ERC20" | "BEP20";
  coinAddress: string;
  pin: string;
}

const INIT: WithdrawForm = {
  amount: "",
  method: "bank",
  bankName: "KB",
  bankAccount: "",
  coinNetwork: "TRC20",
  coinAddress: "",
  pin: "",
};

export interface UseWithdrawOpts {
  available: number;
  minWithdraw: number;
  onSuccess?: () => void;
}

export function useWithdraw({ available, minWithdraw, onSuccess }: UseWithdrawOpts) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<WithdrawForm>(INIT);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => { setForm(INIT); setStep(1); }, []);
  const openModal = useCallback(() => { reset(); setOpen(true); }, [reset]);
  const closeModal = useCallback(() => { setOpen(false); }, []);

  const update = useCallback(<K extends keyof WithdrawForm>(k: K, v: WithdrawForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const amountNum = Number(form.amount) || 0;

  const canNext1 =
    amountNum >= minWithdraw && amountNum <= available && amountNum > 0;
  const canNext2 =
    form.method === "bank"
      ? form.bankAccount.replace(/[^0-9]/g, "").length >= 10
      : form.coinAddress.trim().length >= 20;
  const canSubmit = canNext1 && canNext2 && /^\d{6}$/.test(form.pin);

  const next = useCallback(() => {
    if (step === 1 && !canNext1) {
      if (amountNum < minWithdraw) notify.error(g("withdrawErrMin"));
      else if (amountNum > available) notify.error(g("withdrawErrFunds"));
      return;
    }
    if (step === 2 && !canNext2) {
      notify.error(g("withdrawErrGeneric"));
      return;
    }
    setStep(s => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  }, [step, canNext1, canNext2, amountNum, minWithdraw, available]);

  const prev = useCallback(() => {
    setStep(s => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)));
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await requestWithdrawal({
        amount: amountNum,
        method: form.method,
        bankName: form.method === "bank" ? form.bankName : undefined,
        bankAccount: form.method === "bank" ? form.bankAccount : undefined,
        coinAddress: form.method === "coin" ? form.coinAddress : undefined,
        coinNetwork: form.method === "coin" ? form.coinNetwork : undefined,
        pin: form.pin,
      });
      notify.success(g("withdrawSuccess"), { description: g("withdrawProcessing") });
      setOpen(false);
      reset();
      window.dispatchEvent(new Event("wallet:refresh"));
      onSuccess?.();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("account_frozen")) {
        notify.error(g("withdrawErrFrozen"), { description: "/trust 에서 자세히 확인" });
      } else if (msg.includes("step_up_required")) {
        notify.error(g("withdrawErrStepUp"), { description: "/security/totp 에서 등록해주세요" });
      } else if (msg.includes("pin") || msg.includes("PIN")) {
        notify.error(g("withdrawErrPin"));
        setForm(f => ({ ...f, pin: "" }));
      } else if (msg.includes("below_min")) {
        notify.error(g("withdrawErrMin"));
        setStep(1);
      } else if (msg.includes("insufficient_funds")) {
        notify.error(g("withdrawErrFunds"));
        setStep(1);
      } else {
        notify.error(g("withdrawErrGeneric"), { description: msg.slice(0, 120) });
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, amountNum, form, onSuccess, reset]);

  return {
    open, openModal, closeModal,
    step, next, prev,
    form, update, amountNum,
    canNext1, canNext2, canSubmit,
    submitting, submit,
  };
}
