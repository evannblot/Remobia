import { env } from "cloudflare:workers";
import { createQuotesHandlers } from "../../lib/quotes";

export const dynamic = "force-dynamic";

export function GET() {
  return createQuotesHandlers(env).GET();
}

export async function POST(request: Request) {
  return createQuotesHandlers(env).POST(request);
}
