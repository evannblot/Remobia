export const TRADE_IN_PHOTO_LIMIT = 3 * 1024 * 1024;
export const TRADE_IN_CONDITIONS = {
  excellent: "Très bon état", good: "Bon état", fair: "Traces d’usure", damaged: "Abîmé ou en panne",
} as const;
export const TRADE_IN_ANSWERS = { yes: "Oui", no: "Non", unknown: "Je ne sais pas" } as const;
export const TRADE_IN_DEFECTS = {
  screen: "Écran ou tactile", battery: "Batterie", charging: "Charge", camera: "Appareil photo",
  audio: "Son ou microphone", water: "Contact avec un liquide", other: "Autre problème",
} as const;
export const TRADE_IN_ACCESSORIES = { box: "Boîte", cable: "Câble", charger: "Chargeur" } as const;
export type TradeInDetails = {
  requestId: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: keyof typeof TRADE_IN_CONDITIONS;
  powersOn: keyof typeof TRADE_IN_ANSWERS;
  unlocked: keyof typeof TRADE_IN_ANSWERS;
  battery: number | null;
  defects: (keyof typeof TRADE_IN_DEFECTS)[];
  description: string;
  repairs: string;
  accessories: (keyof typeof TRADE_IN_ACCESSORIES)[];
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  website: string;
};
export type TradeInRequest = Omit<TradeInDetails, "website" | "consent" | "requestId"> & {
  id: string;
  reference: string;
  createdAt: string;
  images: { side: "front" | "back" | "additional1" | "additional2"; url: string }[];
};
