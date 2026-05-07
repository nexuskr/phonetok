import { supabase } from "@/integrations/supabase/client";

export type AdminEmailTemplate =
  | "deposit-approved"
  | "deposit-rejected"
  | "withdraw-approved"
  | "withdraw-completed"
  | "withdraw-rejected";

/**
 * Best-effort email send for admin actions. Never throws — failures are logged
 * to the console only so admin UI flows are not blocked by email issues.
 */
export async function sendAdminNotification(opts: {
  userId: string;
  template: AdminEmailTemplate;
  idempotencyKey: string;
  data?: Record<string, unknown>;
}) {
  try {
    const { data: email, error } = await supabase.rpc("admin_get_user_email" as any, {
      _user_id: opts.userId,
    });
    if (error || !email) return;
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: opts.template,
        recipientEmail: email,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.data ?? {},
      },
    });
  } catch (e) {
    console.warn("[notify] email failed", e);
  }
}
