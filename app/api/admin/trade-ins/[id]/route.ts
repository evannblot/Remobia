import { adminBindings } from "../../../../lib/admin-auth";
import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../../../lib/trade-in-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, context: Context) { return createTradeInHandlers(await adminBindings(env)).DELETE(request, (await context.params).id); }
