import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../../lib/trade-in-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return createTradeInHandlers(env).ADMIN_GET(request); }
