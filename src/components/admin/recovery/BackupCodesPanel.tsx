/**
 * Backup Codes Panel — 본인 TOTP 백업 코드 발급/관리
 * - generate_admin_backup_codes (AAL2 강제)
 * - 발급 직후 1회만 평문 노출 → 다운로드/복사 권장
 */
import { useEffect, useState } from "react";
import { ShieldCheck, Download, Copy, RefreshCw, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

export function BackupCodesPanel() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshCount = async () => {
    const { data } = await supabase.rpc("count_admin_backup_codes" as any);
    setRemaining(typeof data === "number" ? data : 0);
  };
  useEffect(() => { refreshCount(); }, []);

  const generate = async () => {
    if (!confirm("기존 미사용 코드는 모두 무효화됩니다. 새 코드 10개를 발급할까요?")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("generate_admin_backup_codes" as any);
    setBusy(false);
    if (error) {
      notify.error(
        error.message?.includes("aal2_required")
          ? "TOTP 인증(AAL2)이 필요합니다. 인증 앱으로 먼저 재인증해 주세요."
          : `발급 실패: ${error.message}`
      );
      return;
    }
    setCodes((data as string[]) ?? []);
    refreshCount();
    notify.success("백업 코드 10개가 발급되었습니다. 지금 즉시 보관하세요.");
  };

  const copyAll = () => {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join("\n"));
    notify.success("클립보드에 복사되었습니다.");
  };

  const download = () => {
    if (!codes) return;
    const blob = new Blob(
      [
        `Phonara Admin Backup Codes\nGenerated: ${new Date().toISOString()}\n` +
          `WARNING: Each code can be used ONCE to reset your TOTP factor.\n\n` +
          codes.map((c, i) => `${(i + 1).toString().padStart(2, "0")}. ${c}`).join("\n"),
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phonara-admin-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="glass-strong rounded-2xl p-5 border border-border/40 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> 내 백업 코드
          </h2>
          <p className="text-xs text-muted-foreground mt-1 break-keep">
            인증 앱(TOTP)을 분실했을 때 사용. 1회용이며 사용 시 본인의 TOTP factor가 삭제되어
            재등록할 수 있습니다.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest">남은 코드</div>
          <div className="font-display font-black text-2xl tabular-nums">
            {remaining ?? "—"} <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} disabled={busy}>
          <RefreshCw className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} />
          {remaining && remaining > 0 ? "재발급 (기존 무효화)" : "새 코드 10개 발급"}
        </Button>
      </div>

      {codes && (
        <div className="rounded-xl border-2 border-yellow-500/40 bg-yellow-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-yellow-300 text-xs font-bold">
            <ShieldCheck className="h-4 w-4" />
            이 화면을 떠나면 다시 볼 수 없습니다 — 즉시 저장하세요.
          </div>
          <ol className="grid grid-cols-2 sm:grid-cols-2 gap-1.5 font-mono text-sm">
            {codes.map((c, i) => (
              <li key={i} className="flex items-center gap-2 px-2 py-1 bg-background/40 rounded">
                <span className="text-muted-foreground tabular-nums">{(i + 1).toString().padStart(2, "0")}.</span>
                <span className="font-bold tracking-wider">{c}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> 모두 복사
            </Button>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> .txt 다운로드
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        보관 권장: 비밀번호 매니저 (1Password/Bitwarden) 또는 인쇄 후 금고. 코드를 사용하면
        anomaly_events에 자동 기록되며 다른 관리자에게 알림됩니다.
      </p>
    </section>
  );
}
