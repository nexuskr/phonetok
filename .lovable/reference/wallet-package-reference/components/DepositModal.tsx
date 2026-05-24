/**
 * DepositModal — Sprint 3 3-step modal. v1.0.
 *
 * Step 1: 3-method select
 * Step 2: method-specific input
 * Step 3: completion + balance delta + ETA
 *
 * Includes: realtime degraded banner, grace UI, heartbeat, safe-checking copy,
 *   copy verification (last-6 chip via toast), draft resume confirm.
 */
import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { g } from "@pkg/core/i18n/glossary";
import {
  ArrowLeft, Loader2, Clock3, Coins, Banknote, Gift,
  Copy, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCcw, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeposit } from "../hooks/useDeposit";
import { formatCountdown } from "../hooks/useDepositCountdown";
import DepositTimeline from "./DepositTimeline";
import { VOUCHER_BRANDS, DEPOSIT_MIN } from "../lib/depositValidators";
import { sanitizeDigits, sanitizeText } from "../lib/sanitize";

const BANKS = ["KB국민", "신한", "우리", "하나", "농협", "카카오뱅크", "토스뱅크"];

interface Props {
  ctl: ReturnType<typeof useDeposit>;
}

function qrSrc(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
}

export default function DepositModal({ ctl }: Props) {
  const {
    open, close, step, prev,
    method, setMethod, amount, setAmount, amountNum,
    bankName, setBankName, bankAccount, setBankAccount, senderName, setSenderName,
    voucherBrand, setVoucherBrand, voucherPin, setVoucherPin, receiptFile, setReceiptFile,
    intent, beforeBalance, filledRow, receiveAddress,
    countdown, graceChecking, lastChecked, degraded,
    submitting, financialInputsLocked, canNext1, canNext2,
    copy, submit, regenerateIntent, next,
    draft, resumeDraft,
  } = ctl;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close("close_button"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const titles = [g("depositStep1Title"), g("depositStep2Title"), g("depositStep3Title")];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close("backdrop"); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={prev} className="p-2 rounded-lg hover:bg-muted min-h-[40px] min-w-[40px]" aria-label={g("depositPrev")}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <DialogTitle className="text-xl font-black flex-1">{titles[step - 1]}</DialogTitle>
            <span className="text-xs font-black text-amber-300 tabular-nums">{step}/3</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        {/* Resume banner */}
        {draft.resumable && step === 1 && (
          <div className="mx-5 mt-3 p-3 rounded-xl border-2 border-amber-400/60 bg-amber-400/10">
            <div className="text-sm font-black text-amber-300">{g("depositResumeTitle")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{g("depositResumeBody")}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => void resumeDraft()} className="flex-1 min-h-[40px] rounded-lg bg-amber-400 text-neutral-900 font-black text-sm">
                {g("depositResumeContinue")}
              </button>
              <button onClick={draft.clear} className="flex-1 min-h-[40px] rounded-lg border border-border text-sm font-bold">
                {g("depositResumeFresh")}
              </button>
            </div>
          </div>
        )}

        {/* Degraded banner */}
        {degraded && step === 2 && method === "coin" && (
          <div className="mx-5 mt-3 p-2 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs font-bold inline-flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {g("depositRealtimeDegraded")}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <Step1
              method={method}
              setMethod={setMethod}
              amount={amount}
              setAmount={setAmount}
              amountNum={amountNum}
              locked={financialInputsLocked}
            />
          )}
          {step === 2 && (
            <Step2
              method={method}
              amountNum={amountNum}
              intent={intent}
              receiveAddress={receiveAddress}
              countdown={countdown}
              graceChecking={graceChecking}
              lastChecked={lastChecked}
              bankName={bankName} setBankName={setBankName}
              bankAccount={bankAccount} setBankAccount={setBankAccount}
              senderName={senderName} setSenderName={setSenderName}
              voucherBrand={voucherBrand} setVoucherBrand={setVoucherBrand}
              voucherPin={voucherPin} setVoucherPin={setVoucherPin}
              receiptFile={receiptFile} setReceiptFile={setReceiptFile}
              copy={copy}
              regenerateIntent={() => void regenerateIntent()}
            />
          )}
          {step === 3 && (
            <Step3
              method={method}
              amountNum={amountNum}
              beforeBalance={beforeBalance}
              filledRow={filledRow}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          {step === 1 && (
            <button
              onClick={next}
              disabled={!canNext1 || financialInputsLocked}
              className="w-full min-h-[56px] rounded-xl bg-amber-400 text-neutral-900 font-black text-lg disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] transition"
            >
              {g("depositNext")}
            </button>
          )}
          {step === 2 && method !== "coin" && (
            <button
              onClick={() => void submit()}
              disabled={!canNext2 || submitting}
              className="w-full min-h-[56px] rounded-xl bg-amber-400 text-neutral-900 font-black text-lg disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {submitting ? g("depositSubmitLocked") : g("depositSubmit")}
            </button>
          )}
          {step === 2 && method === "coin" && !intent && (
            <button
              onClick={() => void submit()}
              disabled={!canNext2 || submitting}
              className="w-full min-h-[56px] rounded-xl bg-amber-400 text-neutral-900 font-black text-lg disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {submitting ? g("depositSubmitLocked") : g("depositSubmit")}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => close("close_button")}
              className="w-full min-h-[56px] rounded-xl bg-amber-400 text-neutral-900 font-black text-lg active:scale-[0.99] transition"
            >
              {g("depositClose")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Step 1 ────────────────────────────────────────────────
function Step1({ method, setMethod, amount, setAmount, amountNum, locked }: any) {
  const cards: Array<{ k: "coin" | "bank" | "voucher"; label: string; sub: string; icon: any }> = [
    { k: "coin", label: g("depositMethodCoin"), sub: g("depositMethodCoinSub"), icon: Coins },
    { k: "bank", label: g("depositMethodBank"), sub: g("depositMethodBankSub"), icon: Banknote },
    { k: "voucher", label: g("depositMethodVoucher"), sub: g("depositMethodVoucherSub"), icon: Gift },
  ];
  const minAmt = DEPOSIT_MIN[method as "coin" | "bank" | "voucher"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {cards.map(c => (
          <button
            key={c.k}
            type="button"
            disabled={locked}
            onClick={() => setMethod(c.k)}
            className={cn(
              "w-full min-h-[88px] rounded-2xl border p-4 flex items-center gap-3 text-left transition",
              method === c.k
                ? "border-amber-400 bg-amber-400/10 shadow-[0_0_24px_hsl(45_100%_55%/0.25)]"
                : "border-border/40 glass hover:border-amber-400/50",
              locked && "opacity-60 cursor-not-allowed",
            )}
          >
            <c.icon className={cn("w-7 h-7 shrink-0", method === c.k ? "text-amber-300" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <div className="text-xl font-black">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[12px] font-bold text-pink-400 text-center">{g("depositPolicyNotice")}</p>

      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">
          {g("depositAmountLabel")}
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          disabled={locked}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`${g("depositMin")} ${minAmt.toLocaleString()}`}
          className="mt-1.5 w-full min-h-[64px] rounded-xl bg-input border border-border px-4 py-3 text-3xl font-black tabular-nums text-right focus:outline-none focus:border-amber-400 disabled:opacity-60"
        />
        <div className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
          {g("depositMin")}: {minAmt.toLocaleString()} PHON
        </div>
        {amountNum > 0 && amountNum < minAmt && (
          <div className="mt-1 text-sm font-bold text-pink-400">{g("depositErrMin")}</div>
        )}
      </label>

      {locked && (
        <div className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> {g("depositInputsLocked")}
        </div>
      )}
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────
function Step2(props: any) {
  const { method } = props;
  return (
    <div className="space-y-4">
      {method === "coin" && <Step2Coin {...props} />}
      {method === "bank" && <Step2Bank {...props} />}
      {method === "voucher" && <Step2Voucher {...props} />}
    </div>
  );
}

function Step2Coin({ intent, receiveAddress, countdown, graceChecking, lastChecked, copy, regenerateIntent }: any) {
  if (!receiveAddress) {
    return <p className="text-sm text-rose-400 text-center">운영자가 입금 주소를 설정하지 않았습니다.</p>;
  }
  if (!intent) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">{g("depositCoinWaiting")}</p>
      </div>
    );
  }
  const expired = countdown.expired && intent.status !== "filled" && !graceChecking;
  return (
    <div className="space-y-4">
      {/* Timer */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <Clock3 className="w-4 h-4 text-amber-400" />
        <span className={cn(
          "font-mono font-black tabular-nums text-2xl",
          countdown.remainingMs < 60_000 ? "text-pink-400 animate-pulse" : "text-amber-300",
        )}>
          {formatCountdown(countdown.remainingMs)}
        </span>
      </div>

      {/* QR */}
      <div className="flex justify-center">
        <img
          src={qrSrc(intent.receive_address)}
          alt="TRON address QR"
          width={200} height={200}
          className="rounded-xl border border-border bg-white p-1"
        />
      </div>

      {/* Exact amount */}
      <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-400/50 text-center">
        <div className="text-[10px] text-amber-300 font-bold tracking-widest">{g("depositCoinUnique")}</div>
        <div className="font-display font-black text-3xl tabular-nums text-amber-300 mt-1">
          {intent.unique_amount.toFixed(4)} <span className="text-base">USDT</span>
        </div>
        <button
          onClick={() => copy(intent.unique_amount.toFixed(4))}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 min-h-[36px] px-3 rounded-lg border border-amber-400/40"
        >
          <Copy className="w-3.5 h-3.5" /> {g("depositCopy")}
        </button>
      </div>

      {/* Address */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border">
        <div className="text-[10px] text-muted-foreground font-bold">{g("depositCoinAddress")} (TRC20)</div>
        <div className="mt-1 font-mono text-[11px] break-all">{intent.receive_address}</div>
        <button
          onClick={() => copy(intent.receive_address)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 min-h-[36px] px-3 rounded-lg border border-amber-400/40"
        >
          <Copy className="w-3.5 h-3.5" /> {g("depositCopy")}
        </button>
      </div>

      {/* Status */}
      {!expired && (
        <div className="space-y-1 text-center">
          <div className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {graceChecking ? g("depositGraceChecking") : g("depositCoinConfirming")}
          </div>
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-amber-300" /> {g("depositProtectedLine")}
          </div>
          {lastChecked && (
            <div className="text-[10px] text-muted-foreground">
              {g("depositLastChecked")}: {new Date(lastChecked).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {expired && (
        <button
          onClick={regenerateIntent}
          className="w-full min-h-[48px] rounded-xl border border-amber-400/60 text-amber-300 font-black inline-flex items-center justify-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> {g("depositCoinRegenerate")}
        </button>
      )}
    </div>
  );
}

function Step2Bank({ bankName, setBankName, bankAccount, setBankAccount, senderName, setSenderName }: any) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositBankName")}</span>
        <select
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="mt-1.5 w-full min-h-[52px] rounded-xl bg-input border border-border px-4 text-base focus:outline-none focus:border-amber-400"
        >
          {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositBankAccount")}</span>
        <input
          inputMode="numeric"
          value={bankAccount}
          onChange={(e) => setBankAccount(sanitizeDigits(e.target.value, 20))}
          placeholder="123-456-7890123"
          className="mt-1.5 w-full min-h-[52px] rounded-xl bg-input border border-border px-4 text-base tabular-nums focus:outline-none focus:border-amber-400"
        />
      </label>
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositBankSender")}</span>
        <input
          value={senderName}
          onChange={(e) => setSenderName(sanitizeText(e.target.value).slice(0, 30))}
          className="mt-1.5 w-full min-h-[52px] rounded-xl bg-input border border-border px-4 text-base focus:outline-none focus:border-amber-400"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{g("depositBankAutoMatch")}</p>
      </label>
      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-amber-300" /> {g("depositProtectedLine")}
      </p>
    </div>
  );
}

function Step2Voucher({ voucherBrand, setVoucherBrand, voucherPin, setVoucherPin, receiptFile, setReceiptFile }: any) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositVoucherBrand")}</span>
        <select
          value={voucherBrand}
          onChange={(e) => setVoucherBrand(e.target.value)}
          className="mt-1.5 w-full min-h-[52px] rounded-xl bg-input border border-border px-4 text-base focus:outline-none focus:border-amber-400"
        >
          {VOUCHER_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositVoucherPin")}</span>
        <input
          inputMode="numeric"
          value={voucherPin}
          onChange={(e) => setVoucherPin(sanitizeDigits(e.target.value, 18))}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text");
            setVoucherPin(sanitizeDigits(text, 18));
          }}
          placeholder="0000-0000-0000-0000"
          className="mt-1.5 w-full min-h-[52px] rounded-xl bg-input border border-border px-4 text-base tabular-nums tracking-wider focus:outline-none focus:border-amber-400"
        />
      </label>
      <label className="block">
        <span className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">{g("depositVoucherPhoto")}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          className="mt-1.5 w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber-400 file:text-neutral-900 file:font-black"
        />
      </label>
      <p className="text-[11px] text-muted-foreground">{g("depositVoucherKakao")}</p>
      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-amber-300" /> {g("depositProtectedLine")}
      </p>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────
function Step3({ method, amountNum, beforeBalance, filledRow }: any) {
  const eta = method === "coin" ? g("depositEtaCoin")
    : method === "bank" ? g("depositEtaBank")
    : g("depositEtaVoucher");
  const credited = filledRow ? Math.round(filledRow.unique_amount * 1300) : amountNum;

  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="w-16 h-16 text-amber-400 mx-auto" />
      <div className="font-display font-black text-2xl">{g("depositSuccess")}</div>

      <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-400/5 p-4">
        <div className="text-xs text-muted-foreground font-bold">{g("depositDeltaPreview")}</div>
        <div className="text-3xl font-black tabular-nums text-amber-300 mt-1">
          +{credited.toLocaleString()} PHON
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {beforeBalance.toLocaleString()} → {(beforeBalance + credited).toLocaleString()}
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
        <Clock3 className="w-3.5 h-3.5" /> {eta}
      </div>
      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center w-full">
        <ShieldCheck className="w-3 h-3 text-amber-300" /> {g("depositSafeChecking")}
      </p>
    </div>
  );
}
