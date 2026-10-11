import type { MetadataRoute } from "next";
import { publicIndexingEnabled, siteUrl } from "./lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    // Let Google render the public catalogue and its photos, as well as HTML pages.
    // Keep private pages crawlable so their noindex directives can be read.
    // Authentication, rather than robots.txt, protects the owner's information.
    rules: {
      userAgent: "*",
      allow: ["/", "/api/phones$", "/api/phone-images/"],
      disallow: "/api/",
    },
    ...(publicIndexingEnabled() ? { sitemap: siteUrl("/sitemap.xml") } : {}),
  };
}
