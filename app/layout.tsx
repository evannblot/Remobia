import type { Metadata } from "next";
import "./globals.css";
import "./remobia.css";

export const metadata: Metadata = {
  title: "REMOBIA — Réparation et téléphones reconditionnés à Laval",
  description: "Réparation de téléphones à Laval, devis gratuit et catalogue de smartphones reconditionnés. REMOBIA donne une seconde vie à votre appareil.",
  robots: { index: false, follow: false },
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
      <body className="antialiased remobia-site">{children}</body>
    </html>
  );
}
