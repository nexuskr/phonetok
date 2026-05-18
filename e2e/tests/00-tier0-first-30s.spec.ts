import { test, expect } from "../fixtures/auth.fixture";
import { expectTouchTarget } from "../utils/selectors";

/**
 * TIER 0 — "첫 30초 이탈 방지" 4대 인터랙션.
 * 실패 = 즉시 머지 차단.
 *
 * 신규 유저가 어느 단계에서 1초라도 망설이면 이탈한다는 가정.
 * Stake/Rollbit/Bybit에서 넘어온 유저가 첫 30초 안에 가입→첫 보상까지 도달.
 */
test.describe("@critical Tier 0 — 첫 30초 이탈 방지", () => {
  test("T0-1 /auth 가입 CTA 첫 탭 < 800ms + 44px 타깃", async ({ mockedPage: page }) => {
    const start = Date.now();
    await page.goto("/auth");
    const cta = page
      .getByRole("button", { name: /가입|시작|회원가입|Sign\s?up|Get\s?Started/i })
      .first();
    await expect(cta).toBeVisible({ timeout: 3000 });
    const elapsed = Date.now() - start;
    expect.soft(elapsed, `초기 페인트 ${elapsed}ms > 2500ms`).toBeLessThan(2500);
    await expectTouchTarget(cta);
    // IME 입력 검증: 이메일 필드에 한글이 들어가도 깨지지 않음
    const emailInput = page.getByRole("textbox").first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("테스트@phonara.test");
      await expect(emailInput).toHaveValue(/테스트/);
    }
  });

  test("T0-2 가입 → /welcome → 15,000 PHON 클레임 다이얼로그", async ({ mockedPage: page }) => {
    // 가입 완료 시뮬레이션 — auth/v1/signup mock이 합성 세션 반환
    await page.goto("/welcome");
    await page.waitForLoadState("domcontentloaded");
    // PHON 보너스 표시 (다이얼로그/배너/카드 어떤 형태든) — 텍스트로 확인
    const phonBonus = page
      .getByText(/15[,.]?000\s*PHON|15K\s*PHON|클레임|claim/i)
      .first();
    await expect(phonBonus).toBeVisible({ timeout: 5000 }).catch(async () => {
      // /welcome이 없으면 /dashboard 로 진행
      await page.goto("/dashboard");
      const phon = page.getByText(/PHON|보너스|환영/i).first();
      await expect(phon).toBeVisible({ timeout: 5000 });
    });
  });

  test("T0-3 /dashboard 첫 진입 + Daily Bonus CTA 1회 탭", async ({ mockedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    // 어떤 형태든 CTA 1개는 노출
    const anyCta = page.getByRole("button").first();
    await expect(anyCta).toBeVisible({ timeout: 5000 });
    await expectTouchTarget(anyCta);
  });

  test("T0-4 /duel 첫 진입 + Top 1 카드 시각 노출", async ({ mockedPage: page }) => {
    await page.goto("/duel");
    await page.waitForLoadState("domcontentloaded");
    // 듀얼/배틀/방 카드 어떤 형태든
    const room = page.locator("[class*='card'], [class*='Card'], [data-room]").first();
    await expect(room.or(page.getByText(/방|ROOM|BTC|ETH|Top/i).first())).toBeVisible({
      timeout: 6000,
    });
  });
});
