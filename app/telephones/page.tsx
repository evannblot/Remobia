import type { Metadata } from "next";
import PhoneCatalog from "../components/PhoneCatalog";
import { publicPageMetadata } from "../lib/site-config";

export const metadata: Metadata = publicPageMetadata(
  "/telephones",
  "Téléphones reconditionnés à Laval — REMOBIA",
  "Consultez le catalogue de téléphones reconditionnés de REMOBIA à Laval : caractéristiques, état et prix des appareils proposés à la vente.",
);

export default function PhonesPage() {
  return <PhoneCatalog />;
}
