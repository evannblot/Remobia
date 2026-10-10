import type { Metadata } from "next";
import PhoneCatalog from "../components/PhoneCatalog";

export const metadata: Metadata = {
  title: "Téléphones à vendre à Laval — REMOBIA",
  description: "Découvrez les téléphones proposés par REMOBIA à Laval. Consultez les caractéristiques, l’état et le prix de chaque appareil.",
};

export default function PhonesPage() {
  return <PhoneCatalog />;
}
