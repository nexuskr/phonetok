import { Page, Locator } from "@playwright/test";

/** 두 손가락 핀치 줌 시뮬레이션 (Chromium touch synth) */
export async function pinchZoom(page: Page, target: Locator, scale = 2) {
  const box = await target.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 20, y: cy, id: 1 },
      { x: cx + 20, y: cy, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 20 * scale, y: cy, id: 1 },
      { x: cx + 20 * scale, y: cy, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** swipe up/down/left/right on a locator */
export async function swipe(
  page: Page,
  target: Locator,
  dir: "up" | "down" | "left" | "right",
  distance = 120,
) {
  const box = await target.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let dx = 0,
    dy = 0;
  if (dir === "up") dy = -distance;
  if (dir === "down") dy = distance;
  if (dir === "left") dx = -distance;
  if (dir === "right") dx = distance;
  await page.touchscreen.tap(cx, cy);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx, y: cy, id: 1 }],
  });
  for (let i = 1; i <= 10; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: cx + (dx * i) / 10, y: cy + (dy * i) / 10, id: 1 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** 빠른 더블 탭 — idempotency 가드 검증용 */
export async function doubleTap(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.touchscreen.tap(cx, cy);
  await page.touchscreen.tap(cx, cy);
}
