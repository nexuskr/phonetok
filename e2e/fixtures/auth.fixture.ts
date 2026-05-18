import { test as base, expect, Page } from "@playwright/test";
import { installSupabaseMock, MoneyFlowGuard } from "./mock-supabase";
import { installHapticSpy, HapticSpy } from "./haptic-spy";

type Fixtures = {
  mockedPage: Page;
  moneyFlowGuard: MoneyFlowGuard;
  haptic: HapticSpy;
};

export const test = base.extend<Fixtures>({
  moneyFlowGuard: async ({}, use) => {
    const guard: MoneyFlowGuard = { called: [] };
    await use(guard);
    // 머니플로 RPC가 호출되면 즉시 fail
    if (guard.called.length > 0) {
      throw new Error(
        `💀 머니플로 RPC가 실제로 호출됨 — E2E는 100% mock이어야 합니다: ${guard.called.join(", ")}`,
      );
    }
  },
  haptic: async ({}, use) => {
    const spy: HapticSpy = { calls: [] };
    await use(spy);
  },
  mockedPage: async ({ page, moneyFlowGuard, haptic }, use) => {
    await installSupabaseMock(page, moneyFlowGuard);
    await installHapticSpy(page, haptic);
    await use(page);
  },
});

export { expect };
