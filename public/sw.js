/**
 * Phonara Service Worker — PR-24
 * - 백그라운드 알림 표시 (postMessage 또는 push 이벤트)
 * - 알림 클릭 시 /admin/ops/errors 로 포커스
 * VAPID 미구성 환경에서도 postMessage 경로로 동작.
 */
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Page → SW 메시지로 알림 띄우기 (VAPID 없이도 동작)
self.addEventListener("message", (e) => {
  const data = e.data || {};
  if (data.type === "ADMIN_NOTIFY") {
    self.registration.showNotification(data.title || "Phonara Mission Control", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "admin-anomaly",
      requireInteraction: false,
      data: { url: data.url || "/admin/ops/errors" },
    });
  }
});

// 진짜 Web Push (VAPID 구성 시 동작)
self.addEventListener("push", (e) => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch { /* */ }
  const title = payload.title || "🚨 Phonara Alert";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "관리자 콘솔에서 확인하세요",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "admin-push",
      data: { url: payload.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.focus();
          if ("navigate" in w) try { w.navigate(url); } catch { /* */ }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
