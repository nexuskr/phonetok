import { Helmet } from "react-helmet-async";

export type SEOHeadProps = {
  title: string;                    // 페이지 고유 제목 — " · Phonara" 자동 후미
  description: string;              // 160자 이내
  path: string;                     // "/trust" 등 — canonical/og:url 생성
  ogType?: "website" | "article" | "profile";
  noindex?: boolean;                // 비공개 페이지에 사용
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const ORIGIN = "https://phonara.world";
const DEFAULT_OG = `${ORIGIN}/og-image.jpg`;

/**
 * Per-route SEO head. Wrap any public page with this once.
 * - Sitewide og:* in index.html stays as the no-JS fallback for social crawlers.
 * - <Helmet> overrides title/description/canonical/og:* per route for JS-executing crawlers.
 * - Canonical here REPLACES the static index.html canonical (we removed it).
 */
export default function SEOHead({
  title,
  description,
  path,
  ogType = "website",
  noindex = false,
  jsonLd,
}: SEOHeadProps) {
  const fullTitle = title.includes("Phonara") ? title : `${title} · Phonara`;
  const url = `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={DEFAULT_OG} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={DEFAULT_OG} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}
