import type { Metadata } from "next";

export const SITE_URL = "https://remobia.com";
export const SITE_NAME = "REMOBIA";
export const SITE_EMAIL = "remobia.laval@gmail.com";
export const GOOGLE_SITE_VERIFICATION = "fHBs5mCCr9dZiChIoqZv4HbVXGRuqq_3hjqlDvZX37A";
export const SITE_DESCRIPTION =
  "Réparation de téléphones toutes marques à Laval (53000), devis gratuit, estimation de reprise et smartphones reconditionnés. Découvrez REMOBIA.";

// Make the public service pages on remobia.com available to search engines.
// Vercel preview and development deployments must remain outside search results.
export const SITE_INDEXING_ENABLED = true;

export function publicIndexingEnabled(): boolean {
  return SITE_INDEXING_ENABLED && process.env.VERCEL_ENV === "production";
}

export function siteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function publicPageMetadata(
  path: string,
  title: string,
  description: string,
  options: { index?: boolean } = {},
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: siteUrl(path) },
    robots: {
      index: options.index !== false && publicIndexingEnabled(),
      follow: true,
    },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: SITE_NAME,
      url: siteUrl(path),
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl("/#organization"),
      name: SITE_NAME,
      url: siteUrl(),
      email: SITE_EMAIL,
      description: SITE_DESCRIPTION,
      areaServed: {
        "@type": "City",
        name: "Laval",
        containedInPlace: {
          "@type": "AdministrativeArea",
          name: "Mayenne, France",
        },
      },
    },
    {
      "@type": "WebSite",
      "@id": siteUrl("/#website"),
      name: SITE_NAME,
      url: siteUrl(),
      inLanguage: "fr-FR",
      publisher: { "@id": siteUrl("/#organization") },
    },
  ],
};
