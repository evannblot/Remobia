import type { MetadataRoute } from "next";
import { publicIndexingEnabled, siteUrl } from "./lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!publicIndexingEnabled()) return [];

  // Only canonical, indexable service pages belong in this sitemap.
  // Do not fabricate modification dates or expose owner-only routes.
  return ["/", "/telephones", "/reprise"].map((path) => ({ url: siteUrl(path) }));
}
