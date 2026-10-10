import { adminBindings } from "../../../../../lib/admin-auth";
import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../../../../lib/trade-in-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; side: string }> };
export async function GET(request: Request, context: Context) {
  const { id, side } = await context.params;
  return createTradeInHandlers(await adminBindings(env)).IMAGE_GET(request, id, side);
}
