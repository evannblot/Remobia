import { env } from "cloudflare:workers";
import { getPublishedPhone } from "../../lib/catalog-server";
import { createInterestHandlers } from "../../lib/phone-interest";

export const dynamic = "force-dynamic";

function handlers() {
  return createInterestHandlers(env, {
    readPhone: async (id) => {
      if (!env.DB) throw new Error("Catalogue indisponible");
      return getPublishedPhone(env.DB, id);
    },
  });
}

export function GET() { return handlers().GET(); }
export function POST(request: Request) { return handlers().POST(request); }
