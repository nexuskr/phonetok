/**
 * PR-P1-A — Crown → PHON glossary
 *
 * 정적 매핑 + 후처리 헬퍼. 사용자 노출 텍스트만 변환할 것.
 * 백엔드 식별자(award_crown, crown_events 등)는 절대 변환 대상 아님.
 */

const RULES: Array<[RegExp, string]> = [
  [/👑/g, "💎"],
  [/크라운\s*레벨/g, "VIP 레벨"],
  [/크라운\s*포인트/g, "PHON 포인트"],
  [/크라운\s*부스터/g, "PHON 부스터"],
  [/크라운\s*폭발/g, "PHON 잭팟"],
  [/크라운/g, "PHON"],
  [/\bEmpire\s+Crown\s+Booster\b/g, "PHON Booster"],
  [/\bCrown\s+Booster\b/g, "PHON Booster"],
  [/\bCrown\s+Multiplier\b/g, "PHON Booster"],
  [/\bCrown\s+Level\b/g, "VIP Level"],
  [/\bCrown\s+Point(s)?\b/g, "PHON Point$1"],
  [/\bCrown\s+War\b/g, "PHON War"],
  [/\bCrown\s+Aura\b/g, "PHON Glow"],
  [/\bCrown\s+Reward(s)?\b/g, "PHON Reward$1"],
  [/\bCrown\s+Bonus\b/g, "PHON Bonus"],
  [/\bCrown\b/g, "PHON"],
];

export function phonize(text: string | null | undefined): string {
  if (!text) return "";
  let out = text;
  for (const [pat, sub] of RULES) out = out.replace(pat, sub);
  return out;
}
