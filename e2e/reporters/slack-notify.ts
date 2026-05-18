import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/**
 * Slack 실패 알림 — SLACK_WEBHOOK_E2E 있을 때만.
 */
export default class SlackNotify implements Reporter {
  private failures: string[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "failed" || result.status === "timedOut") {
      this.failures.push(`• ${test.parent.title} > ${test.title}: ${result.error?.message?.split("\n")[0] || "fail"}`);
    }
  }

  async onEnd(_result: FullResult) {
    const url = process.env.SLACK_WEBHOOK_E2E;
    if (!url || this.failures.length === 0) return;
    const text = `🚨 *Phonara E2E 실패 ${this.failures.length}건*\n${this.failures.slice(0, 10).join("\n")}\n\n👉 GitHub Actions 아티팩트에서 HTML 리포트 확인`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.error("Slack 알림 실패:", (e as Error).message);
    }
  }
}
