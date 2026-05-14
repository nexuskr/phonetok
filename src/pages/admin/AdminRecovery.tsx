/**
 * /admin/ops/recovery — Admin TOTP Recovery Console
 * 본인 백업 코드 + 4-eyes 동료 복구 큐를 한 페이지에 묶음.
 */
import { BackupCodesPanel } from "@/components/admin/recovery/BackupCodesPanel";
import { RecoveryRequestsPanel } from "@/components/admin/recovery/RecoveryRequestsPanel";

export default function AdminRecovery() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-2xl sm:text-3xl">🔐 관리자 복구</h1>
        <p className="text-xs text-muted-foreground mt-1">
          TOTP 분실 시 3-Layer 안전망 — 본인 백업 코드 / 4-Eyes 동료 복구 / Break-Glass 절차
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BackupCodesPanel />
        <RecoveryRequestsPanel />
      </div>

      <section className="glass rounded-2xl p-5 border border-border/40 text-sm space-y-2">
        <h3 className="font-bold flex items-center gap-2">🚨 Break-Glass 절차 (모든 admin 잠금 시)</h3>
        <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground break-keep">
          <li>운영팀이 보관 중인 <b>긴급 시드</b>(금고/매니저)로 인증 앱 복원 시도.</li>
          <li>실패 시 Lovable Cloud 콘솔에서 직접:&nbsp;
            <code className="text-[11px]">delete from auth.mfa_factors where user_id='&lt;uid&gt;' and factor_type='totp';</code>
          </li>
          <li>그 후 즉시 본인 로그인 → /security/totp 재등록 → 백업 코드 신규 발급.</li>
          <li>전 과정은 docs/operations/admin-recovery-runbook.md 에 따라 사후 보고서 필수.</li>
        </ol>
      </section>
    </div>
  );
}
