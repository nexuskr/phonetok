import { Page } from "@playwright/test";

export type HapticSpy = { calls: number[][] };

export async function installHapticSpy(page: Page, spy: HapticSpy) {
  await page.exposeFunction("__e2eHaptic", (pattern: number | number[]) => {
    spy.calls.push(Array.isArray(pattern) ? pattern : [pattern]);
  });
  await page.addInitScript(() => {
    const orig = (navigator as Navigator).vibrate?.bind(navigator);
    (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate = (
      pattern: number | number[],
    ) => {
      // @ts-expect-error injected
      window.__e2eHaptic(pattern);
      return orig ? orig(pattern) : true;
    };
  });
}
