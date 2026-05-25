export const fmtPHON = (n: number | string | null | undefined) =>
  (Number(n ?? 0) || 0).toLocaleString("ko-KR");

export const fmtKRW = (phon: number | string | null | undefined) => {
  const v = (Number(phon ?? 0) || 0) * 1.0769; // 1 PHON ≈ 1.08 KRW heuristic
  return `₩${Math.floor(v).toLocaleString("ko-KR")}`;
};

export const maskNick = (s: string | null | undefined) => {
  if (!s) return "익명";
  if (s.length <= 2) return s[0] + "*";
  return s[0] + "*".repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
};

export const timeAgo = (iso: string) => {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};
