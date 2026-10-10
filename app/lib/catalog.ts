export type PhoneListing = {
  id: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: "excellent" | "good" | "fair";
  priceCents: number;
  battery: number | null;
  description: string;
  status: "draft" | "published" | "sold";
  images: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export const conditionLabels: Record<PhoneListing["condition"], string> = {
  excellent: "Excellent état",
  good: "Bon état",
  fair: "État correct",
};

export const statusLabels: Record<PhoneListing["status"], string> = {
  draft: "Brouillon",
  published: "En vente",
  sold: "Vendu",
};

export function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(priceCents / 100);
}
