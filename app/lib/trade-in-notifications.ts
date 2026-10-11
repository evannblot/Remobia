import { getEmailConfig, type QuoteEnvironment } from "./quotes";
import type { CatalogBindings } from "./catalog-server";
import { TRADE_IN_ANSWERS, TRADE_IN_CONDITIONS, TRADE_IN_DEFECTS, TRADE_IN_ACCESSORIES, type TradeInDetails } from "./trade-in";

type NotificationBindings = CatalogBindings & QuoteEnvironment;
type Pending = { id: string; reference: string; details: string; created_at: string };

function message(row: Pending, details: TradeInDetails): string {
  return ["Nouvelle demande d’estimation REMOBIA", `Référence : ${row.reference}`, `Reçue le : ${row.created_at}`, "",
    `Nom : ${details.name}`, `Email : ${details.email}`, `Téléphone : ${details.phone || "Non renseigné"}`, "",
    `Appareil : ${details.brand} ${details.model}`, `Stockage : ${details.storage || "Non renseigné"}`, `Couleur : ${details.color || "Non renseignée"}`,
    `État : ${TRADE_IN_CONDITIONS[details.condition]}`, `S’allume : ${TRADE_IN_ANSWERS[details.powersOn]}`,
    `Déverrouillé : ${TRADE_IN_ANSWERS[details.unlocked]}`, `Batterie : ${details.battery === null ? "Non renseignée" : `${details.battery} %`}`,
    `Problèmes connus : ${details.defects.map(value => TRADE_IN_DEFECTS[value]).join(", ") || "Aucun signalé"}`,
    "Description :", details.description || "Aucune précision", "Réparations antérieures :", details.repairs || "Non renseignées",
    `Accessoires : ${details.accessories.map(value => TRADE_IN_ACCESSORIES[value]).join(", ") || "Aucun signalé"}`, "",
    "Les photos de l’avant et de l’arrière sont disponibles dans votre espace propriétaire :",
    "https://remobia.com/gestion/reprises", "",
    "Répondez à cet email pour contacter directement le client. Cette demande gratuite n’engage pas le client à vendre.",
  ].join("\n");
}

/** The outbox is committed with the request. Email failure never erases saved photos. */
export async function notifyTradeIn(bindings: NotificationBindings, resourceId: string, options: { fetcher?: typeof fetch; timeoutMs?: number } = {}): Promise<boolean> {
  const config = getEmailConfig(bindings);
  const db = bindings.DB;
  if (!config || !db || !bindings.TRADE_IN_NOTIFICATIONS_ENABLED) return false;
  const row = await db.prepare("SELECT o.id, r.reference, r.details, r.created_at FROM notification_outbox o INNER JOIN trade_in_requests r ON r.id = o.resource_id WHERE o.resource_id = ? AND o.sent_at IS NULL AND r.state = 'active'").bind(resourceId).first<Pending>();
  if (!row) return true;
  const details = JSON.parse(row.details) as TradeInDetails;
  const body = JSON.stringify({ from: config.from, to: [config.to], reply_to: details.email,
    subject: `Demande d’estimation — ${row.reference}`, text: message(row, details) });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))), byte => byte.toString(16).padStart(2, "0")).join("");
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    let transient = true;
    try {
      await db.prepare("UPDATE notification_outbox SET attempts = attempts + 1 WHERE id = ? AND sent_at IS NULL").bind(row.id).run();
      const response = await (options.fetcher ?? fetch)("https://api.resend.com/emails", { method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `trade-in-${hash}` },
        body, signal: controller.signal });
      transient = response.status === 429 || response.status >= 500;
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" && "id" in result && typeof result.id === "string" && result.id.trim()) {
          await db.prepare("UPDATE notification_outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL").bind(new Date().toISOString(), row.id).run();
          return true;
        }
      }
    } catch { /* A later retry uses the exact same body and idempotency key. */ }
    finally { clearTimeout(timer); }
    if (!transient) break;
  }
  return false;
}

export async function retryTradeInNotifications(bindings: NotificationBindings): Promise<void> {
  if (!bindings.DB || !getEmailConfig(bindings) || !bindings.TRADE_IN_NOTIFICATIONS_ENABLED) return;
  const pending = await bindings.DB.prepare("SELECT o.resource_id FROM notification_outbox o INNER JOIN trade_in_requests r ON r.id = o.resource_id WHERE o.sent_at IS NULL AND r.state = 'active' ORDER BY o.created_at LIMIT 5").all<{ resource_id: string }>();
  for (const row of pending.results) await notifyTradeIn(bindings, row.resource_id).catch(() => false);
}
