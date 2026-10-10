import { adminBindings } from "../../../lib/admin-auth";
import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../../lib/trade-in-server";
import { after } from "next/server";
import { retryTradeInNotifications } from "../../../lib/trade-in-notifications";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const response = await createTradeInHandlers(await adminBindings(env)).ADMIN_GET(request);
  if (response.ok && process.env.VERCEL !== undefined) after(async () => { await retryTradeInNotifications(env).catch(() => undefined); });
  return response;
}
