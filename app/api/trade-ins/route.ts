import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../lib/trade-in-server";
import { after } from "next/server";
import { notifyTradeIn } from "../../lib/trade-in-notifications";

export const dynamic = "force-dynamic";
export async function GET() { return createTradeInHandlers(env).GET(); }
export async function POST(request: Request) {
  const response = await createTradeInHandlers(env).POST(request);
  if (response.ok && process.env.VERCEL !== undefined) {
    const receipt = await response.clone().json() as { id?: unknown };
    if (typeof receipt.id === "string") {
      const id = receipt.id;
      after(async () => { await notifyTradeIn(env, id).catch(() => false); });
    }
  }
  return response;
}
