import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDB } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";
import { track } from "@/lib/analytics";

type Offer = {
  send_id: string;
  campaign_id: string;
  campaign_key: string;
  title: string;
  body: string;
  cta_label: string;
  phon_bonus: number;
  expires_at: string;
  channel: string;
};

const STORAGE_KEY = "phonara_reactivation_dismissed";

export default function ReactivationOfferDialog() {
  const [db] = useDB();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!db.user) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_reactivation_offer");
        if (error || cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return;
        // Skip if user dismissed this exact send already
        try {
          const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          if (Array.isArray(dismissed) && dismissed.includes(row.send_id)) return;
        } catch {}
        setOffer(row as Offer);
        setOpen(true);
        // mark opened (fire-and-forget)
        supabase.rpc("mark_reactivation_event", { _send_id: row.send_id, _event: "open" });
        track("reactivation_offer_shown", { campaign: row.campaign_key });
      } catch {}
    }, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db.user]);

  async function claim() {
    if (!offer) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_reactivation_offer", { _send_id: offer.send_id });
      if (error) throw error;
      const result = data as { ok: boolean; phon_credited?: number; reason?: string };
      if (!result?.ok) {
        notify.warning("보너스 만료", { description: result?.reason === "expired" ? "오퍼가 만료되었습니다." : "이미 수령했습니다." });
      } else {
        notify.success(`👑 +${result.phon_credited?.toLocaleString()} PHON 입금`, {
          description: "복귀를 환영합니다, 황제여.",
        });
        track("reactivation_offer_claimed", { campaign: offer.campaign_key, phon: result.phon_credited });
      }
      setOpen(false);
    } catch (e) {
      notify.fail("오류", e);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    if (offer) {
      try {
        const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const arr = Array.isArray(dismissed) ? dismissed : [];
        arr.push(offer.send_id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-50)));
      } catch {}
      track("reactivation_offer_dismissed", { campaign: offer.campaign_key });
    }
    setOpen(false);
  }

  if (!offer) return null;

  const hoursLeft = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 3_600_000));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{offer.title}</DialogTitle>
          <DialogDescription className="text-base text-foreground/80">
            {offer.body}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
          <div className="text-3xl font-black text-primary">+{offer.phon_bonus.toLocaleString()} PHON</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {hoursLeft > 0 ? `${hoursLeft}시간 내 수령` : "만료 임박"}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={dismiss} disabled={busy}>나중에</Button>
          <Button onClick={claim} disabled={busy} className="font-bold">
            {busy ? "처리 중…" : offer.cta_label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
