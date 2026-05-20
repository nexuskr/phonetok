/**
 * PR-P0-4 — Unified withdrawal/settlement error mapping.
 *
 * Single source of truth for raw RPC / Postgres error strings → user-facing
 * Korean messages + actionable hints. Covers `request_withdrawal`,
 * `apex_request_cashout`, LPI (`lpi_*`), oracle (`oracle_*`), idempotency
 * collisions, AAL2/step-up, account freeze, and rate-limit.
 *
 * money-flow RPC bodies are NOT modified — this is a pure client mapper.
 */

export type WithdrawErrorCode =
  | "account_frozen"
  | "step_up_required"
  | "aal2_required"
  | "pin_mismatch"
  | "below_min"
  | "insufficient_funds"
  | "daily_limit"
  | "velocity"
  | "rate_limited"
  | "kill_switch"
  | "duplicate_in_flight"
  | "lpi_conflict"
  | "oracle_unavailable"
  | "price_moved"
  | "unauthenticated"
  | "network"
  | "unknown";

export interface ParsedWithdrawError {
  code: WithdrawErrorCode;
  title: string;
  description: string;
  /** Input-correction hints for the form. */
  resetPin?: boolean;
  gotoStep?: 1 | 2 | 3;
  /** Optional client-side cooldown before next retry, ms. */
  cooldownMs?: number;
  /** True when retrying immediately is unlikely to help — show CTA instead. */
  blocking?: boolean;
}

interface Rule {
  test: RegExp;
  code: WithdrawErrorCode;
  title: string;
  description: string | ((min: number) => string);
  resetPin?: boolean;
  gotoStep?: 1 | 2 | 3;
  cooldownMs?: number;
  blocking?: boolean;
}

const RULES: Rule[] = [
  {
    test: /account_frozen/i,
    code: "account_frozen",
    title: "계정이 일시 보호 중입니다",
    description:
      "이상 활동이 감지되어 자동 보호가 적용됐어요. 본인이 한 시도가 아니라면 즉시 고객센터로 문의해 주세요.",
    blocking: true,
  },
  {
    test: /step_up_required/i,
    code: "step_up_required",
    title: "추가 인증이 필요해요",
    description: "잠시 후 인증 창이 열립니다. 등록한 인증 앱의 6자리 코드를 입력해 주세요.",
  },
  {
    test: /aal2_required/i,
    code: "aal2_required",
    title: "보안 인증(AAL2)이 필요해요",
    description: "출금을 위해 2단계 보안 인증을 완료해 주세요.",
    blocking: true,
  },
  {
    test: /pin mismatch|invalid pin|wrong_pin/i,
    code: "pin_mismatch",
    title: "출금 비밀번호가 일치하지 않습니다",
    description: "6자리 출금 비밀번호를 다시 입력해 주세요.",
    resetPin: true,
    gotoStep: 3,
  },
  {
    test: /below_min/i,
    code: "below_min",
    title: "최소 출금 금액 미만입니다",
    description: (min) => `최소 ${min.toLocaleString()} PHON부터 출금이 가능합니다.`,
    gotoStep: 1,
  },
  {
    test: /insufficient_funds|insufficient[_ ]?balance/i,
    code: "insufficient_funds",
    title: "출금 가능 잔액이 부족합니다",
    description: "현재 사용 가능 잔액을 확인해 주세요.",
    gotoStep: 1,
  },
  {
    test: /daily_withdraw_limit|daily_limit/i,
    code: "daily_limit",
    title: "오늘 출금 한도를 모두 사용하셨어요",
    description: "자정에 한도가 초기화됩니다.",
    blocking: true,
  },
  {
    test: /velocity/i,
    code: "velocity",
    title: "단시간 출금 속도 한도를 초과했어요",
    description: "잠시 후 다시 시도해 주세요.",
    cooldownMs: 30_000,
  },
  {
    test: /rate[_ ]?limit|too_many/i,
    code: "rate_limited",
    title: "잠시 후 다시 시도해 주세요",
    description: "짧은 시간에 요청이 너무 많아요.",
    cooldownMs: 10_000,
  },
  {
    test: /kill_switch|withdrawals_halt/i,
    code: "kill_switch",
    title: "출금이 일시 중단되었습니다",
    description: "점검 또는 보안 사유로 일시 중단된 상태입니다. 잠시 후 다시 시도해 주세요.",
    blocking: true,
  },
  {
    test: /duplicate_in_flight|idempotency_hit|idem[_-]?key.*exists/i,
    code: "duplicate_in_flight",
    title: "이미 처리 중인 요청이 있어요",
    description: "잠시만 기다려 주세요. 결과가 곧 표시됩니다.",
    cooldownMs: 7_000,
  },
  {
    test: /lpi_claim_race|lpi_terminal_state_immutable|lpi_invalid_transition|lpi_immutable_fields_changed|crid_param_mismatch|crid_user_mismatch|lease_lost_during_execution/i,
    code: "lpi_conflict",
    title: "처리 중 충돌이 감지되었습니다",
    description: "잠시 후 다시 시도해 주세요. 새로고침 후 재시도하면 안전합니다.",
    cooldownMs: 3_000,
  },
  {
    test: /oracle_unavailable|oracle_stale/i,
    code: "oracle_unavailable",
    title: "시세를 가져올 수 없어요",
    description: "잠시 후 다시 시도해 주세요.",
    cooldownMs: 5_000,
  },
  {
    test: /price_moved_resync/i,
    code: "price_moved",
    title: "가격이 크게 움직였어요",
    description: "새 가격으로 다시 시도해 주세요.",
  },
  {
    test: /unauthenticated|not_authenticated|42501/i,
    code: "unauthenticated",
    title: "로그인이 필요해요",
    description: "다시 로그인 후 출금을 진행해 주세요.",
    blocking: true,
  },
  {
    test: /NetworkError|Failed to fetch|AbortError|timeout/i,
    code: "network",
    title: "네트워크가 불안정해요",
    description: "연결 상태를 확인하고 다시 시도해 주세요.",
    cooldownMs: 2_000,
  },
];

export function parseWithdrawError(raw: unknown, minWithdraw = 0): ParsedWithdrawError {
  const msg = String((raw as { message?: string } | string | null | undefined) ?? "")
    .toString();
  const text =
    typeof raw === "string" ? raw : (raw as { message?: string } | null)?.message ?? msg;

  for (const r of RULES) {
    if (r.test.test(text)) {
      return {
        code: r.code,
        title: r.title,
        description: typeof r.description === "function" ? r.description(minWithdraw) : r.description,
        resetPin: r.resetPin,
        gotoStep: r.gotoStep,
        cooldownMs: r.cooldownMs,
        blocking: r.blocking,
      };
    }
  }

  return {
    code: "unknown",
    title: "요청을 처리하지 못했어요",
    description: "잠시 후 다시 시도해 주세요. 문제가 지속되면 고객센터로 문의해 주세요.",
  };
}

/**
 * Global event bridge — emit when `account_frozen` is detected anywhere
 * so the App-level `<AccountFrozenDialog />` can surface the rich UX.
 */
export const FROZEN_EVENT = "phonara:account-frozen";

export function emitAccountFrozen(detail?: { source?: string; description?: string }) {
  try {
    window.dispatchEvent(new CustomEvent(FROZEN_EVENT, { detail: detail ?? {} }));
  } catch {
    /* SSR / non-DOM contexts */
  }
}
