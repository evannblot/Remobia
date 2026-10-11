import type { MetadataRoute } from "next";
import { publicIndexingEnabled, siteUrl } from "./lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    // Keep HTML pages crawlable so Google can read their noindex directives.
    // Authentication, rather than robots.txt, protects the owner's information.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    ...(publicIndexingEnabled() ? { sitemap: siteUrl("/sitemap.xml") } : {}),
  };
}
