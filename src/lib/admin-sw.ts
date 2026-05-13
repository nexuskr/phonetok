/**
 * registerAdminServiceWorker — PR-24
 * 관리자가 PUSH 토글 ON 시 호출하면 SW 등록 후 알림 채널을 확보한다.
 */
let registration: ServiceWorkerRegistration | null = null;
let registering: Promise<ServiceWorkerRegistration | null> | null = null;

export async function ensureAdminSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (registration) return registration;
  if (registering) return registering;
  registering = (async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      registration = reg;
      return reg;
    } catch {
      return null;
    } finally {
      registering = null;
    }
  })();
  return registering;
}

export async function notifyViaSW(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  const reg = await ensureAdminSW();
  if (!reg) return false;
  try {
    if (Notification.permission !== "granted") return false;
    const sw = reg.active || reg.waiting || reg.installing;
    sw?.postMessage({ type: "ADMIN_NOTIFY", ...payload });
    return true;
  } catch {
    return false;
  }
}
