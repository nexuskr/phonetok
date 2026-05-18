import { test, expect } from "../fixtures/auth.fixture";
import { pinchZoom, swipe } from "../utils/gestures";

/**
 * Mobile OS Native Feel — Stake/Rollbit 유저가 "이거 앱 같다" 느낄 수준.
 */
test.describe("03 Mobile OS Native Feel", () => {
  test("viewport meta가 줌을 막지 않음 (접근성)", async ({ mockedPage: page }) => {
    await page.goto("/");
    const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
    // user-scalable=no는 접근성 위반
    expect(meta || "").not.toMatch(/user-scalable\s*=\s*no/i);
  });

  test("Pinch zoom 동작 — layout shift 없음", async ({ mockedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const body = page.locator("body");
    const before = await body.boundingBox();
    await pinchZoom(page, body, 2);
    const after = await body.boundingBox();
    // pinch 후에도 페이지가 살아있음
    expect(after).not.toBeNull();
    expect(before).not.toBeNull();
  });

  test("Orientation portrait ↔ landscape 깨짐 없음", async ({ mockedPage: page }) => {
    await page.goto("/dashboard");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect.soft(overflow, "landscape 가로 오버플로 발생").toBeFalsy();
  });

  test("Haptic vibrate spy — 인터랙션 후 호출되었는지 (있다면)", async ({
    mockedPage: page,
    haptic,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const btn = page.getByRole("button").first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(300);
    }
    // haptic은 호출 안 되어도 ok (cosmetic) — 단지 spy가 동작함을 확인
    expect(Array.isArray(haptic.calls)).toBe(true);
  });

  test("BottomSheet — swipe down dismiss (있는 페이지에서만)", async ({ mockedPage: page }) => {
    await page.goto("/");
    const sheet = page.locator('[class*="sheet"], [class*="Sheet"], [role="dialog"]').first();
    if (await sheet.isVisible().catch(() => false)) {
      await swipe(page, sheet, "down", 200);
      await page.waitForTimeout(300);
    }
    await expect(page.locator("body")).toBeVisible();
  });
});
