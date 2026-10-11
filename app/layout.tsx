import type { Metadata } from "next";
import { GOOGLE_SITE_VERIFICATION, publicPageMetadata, SITE_DESCRIPTION, SITE_URL, siteStructuredData } from "./lib/site-config";
import "./globals.css";
import "./remobia.css";

export const metadata: Metadata = {
  ...publicPageMetadata("/", "REMOBIA — Réparation, reprise et reconditionnés à Laval", SITE_DESCRIPTION),
  metadataBase: new URL(SITE_URL),
  verification: { google: GOOGLE_SITE_VERIFICATION },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased remobia-site">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteStructuredData).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
