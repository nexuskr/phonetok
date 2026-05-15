// Static lookup of approximate (lat, lng) for the most common ISO-3166 alpha-2
// country codes. Used by the auth page to plot live-feed pulses on a screen
// projection. Not geographically precise — for visual flair only.

export type LatLng = { lat: number; lng: number };

export const COUNTRY_LAT_LNG: Record<string, LatLng> = {
  KR: { lat: 37.55, lng: 126.99 },
  JP: { lat: 35.68, lng: 139.69 },
  CN: { lat: 31.23, lng: 121.47 },
  TW: { lat: 25.03, lng: 121.56 },
  HK: { lat: 22.32, lng: 114.17 },
  SG: { lat: 1.35, lng: 103.82 },
  TH: { lat: 13.75, lng: 100.5 },
  VN: { lat: 10.78, lng: 106.7 },
  ID: { lat: -6.21, lng: 106.85 },
  MY: { lat: 3.14, lng: 101.69 },
  PH: { lat: 14.6, lng: 121.0 },
  IN: { lat: 19.08, lng: 72.88 },
  AE: { lat: 25.2, lng: 55.27 },
  SA: { lat: 24.71, lng: 46.68 },
  TR: { lat: 41.01, lng: 28.98 },
  RU: { lat: 55.75, lng: 37.62 },
  DE: { lat: 52.52, lng: 13.4 },
  FR: { lat: 48.86, lng: 2.35 },
  GB: { lat: 51.51, lng: -0.13 },
  IT: { lat: 41.9, lng: 12.5 },
  ES: { lat: 40.42, lng: -3.7 },
  NL: { lat: 52.37, lng: 4.9 },
  CH: { lat: 47.38, lng: 8.54 },
  SE: { lat: 59.33, lng: 18.07 },
  NO: { lat: 59.91, lng: 10.75 },
  PL: { lat: 52.23, lng: 21.01 },
  PT: { lat: 38.72, lng: -9.14 },
  IE: { lat: 53.35, lng: -6.26 },
  US: { lat: 40.71, lng: -74.0 },
  CA: { lat: 43.65, lng: -79.38 },
  MX: { lat: 19.43, lng: -99.13 },
  BR: { lat: -23.55, lng: -46.63 },
  AR: { lat: -34.6, lng: -58.38 },
  CL: { lat: -33.45, lng: -70.66 },
  CO: { lat: 4.71, lng: -74.07 },
  AU: { lat: -33.87, lng: 151.21 },
  NZ: { lat: -36.85, lng: 174.76 },
  ZA: { lat: -26.2, lng: 28.04 },
  EG: { lat: 30.04, lng: 31.24 },
  NG: { lat: 6.45, lng: 3.4 },
  KE: { lat: -1.29, lng: 36.82 },
  IL: { lat: 32.08, lng: 34.78 },
  QA: { lat: 25.28, lng: 51.53 },
  KW: { lat: 29.38, lng: 47.99 },
  PK: { lat: 24.86, lng: 67.0 },
  BD: { lat: 23.81, lng: 90.41 },
};

export const FLAG_BY_CC: Record<string, string> = Object.fromEntries(
  Object.keys(COUNTRY_LAT_LNG).map((cc) => [
    cc,
    String.fromCodePoint(...cc.split("").map((c) => 127397 + c.charCodeAt(0))),
  ])
);

const CC_LIST = Object.keys(COUNTRY_LAT_LNG);

/** Deterministic pseudo-country from any string (nick / id) — for visual flair only. */
export function pseudoCountry(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % CC_LIST.length;
  return CC_LIST[idx];
}

/** Project a (lat, lng) to a 2D % position on an equirectangular canvas. */
export function projectLatLng(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { xPct: x, yPct: y };
}
