// Tiny helper to render real flag images via flagcdn (no API key, CDN-cached).
// We keep emoji as fallback for offline/CSP-restricted environments.
export function flagSvgUrl(cc: string, w: 20 | 40 | 80 = 40): string {
  const c = (cc || "").toLowerCase();
  if (!c || c.length !== 2) return "";
  return `https://flagcdn.com/w${w}/${c}.png`;
}
