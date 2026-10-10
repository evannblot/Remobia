import { env } from "cloudflare:workers";
import { createTradeInHandlers } from "../../lib/trade-in-server";

export const dynamic = "force-dynamic";
export async function GET() { return createTradeInHandlers(env).GET(); }
export async function POST(request: Request) { return createTradeInHandlers(env).POST(request); }
