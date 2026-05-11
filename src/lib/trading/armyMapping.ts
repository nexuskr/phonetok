/**
 * 가격 변동 → 군대 상태 매핑.
 * 입력: 베팅 방향, 진입가, 현재가, PnL%, 1초간 변동률
 * 출력: 군대 진격도(0~1), 사기, 파티클 강도, 흔들림, 전선 X 좌표
 */
export type Side = "long" | "short";

export type ArmyState = {
  frontline: number;     // 0(시작) ~ 1(완전 정복/약탈)
  marchSpeed: number;    // 0~1
  morale: number;        // 0~1
  particle: number;      // 0~1
  shake: number;         // 0~1
  status: "idle" | "marching" | "retreating" | "victory" | "defeat" | "near_miss" | "recovery";
};

export function mapPnlToArmy(opts: {
  side: Side;
  pnlPct: number;        // -100 ~ +Inf, 보통 -5 ~ +5
  delta1s: number;       // 최근 1초 가격변동률 (%)
  tpPct: number;
  slPct: number;
}): ArmyState {
  const { pnlPct, delta1s, tpPct, slPct, side } = opts;

  // pnl 진행도: 0 → tp 도달 시 1, sl 도달 시 0, 음수는 후퇴 표현
  const progress = Math.max(-1, Math.min(1, pnlPct / Math.max(tpPct, 0.5)));
  const frontline = Math.max(0, Math.min(1, 0.4 + progress * 0.55)); // 0.4 기본 진형
  const moving = Math.abs(delta1s);
  // 같은 방향이면 양수, 반대면 음수
  const aligned = side === "long" ? delta1s : -delta1s;
  const marchSpeed = Math.max(0, Math.min(1, 0.15 + aligned * 0.6));
  const morale = Math.max(0.1, Math.min(1, 0.55 + progress * 0.4));
  const particle = Math.max(0, Math.min(1, moving * 0.4));
  const shake = Math.max(0, Math.min(1, moving * 0.8));

  let status: ArmyState["status"] = "marching";
  if (pnlPct >= tpPct) status = "victory";
  else if (pnlPct <= -slPct) status = "defeat";
  else if (pnlPct >= tpPct * 0.85 && delta1s < 0 && side === "long") status = "near_miss";
  else if (pnlPct <= -slPct * 0.85 && delta1s > 0 && side === "long") status = "recovery";
  else if (aligned < -0.1) status = "retreating";

  return { frontline, marchSpeed, morale, particle, shake, status };
}

export const IDLE_ARMY: ArmyState = {
  frontline: 0.35, marchSpeed: 0.1, morale: 0.6, particle: 0, shake: 0, status: "idle",
};
