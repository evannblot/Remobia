import { env } from "cloudflare:workers";
import { createCatalogHandlers } from "../../lib/catalog-server";

export const dynamic = "force-dynamic";

export async function GET() { return createCatalogHandlers(env).PUBLIC_GET(); }
