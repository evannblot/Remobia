import { env } from "cloudflare:workers";
import { createCatalogHandlers } from "../../../lib/catalog-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) { return createCatalogHandlers(env).IMAGE_GET(request, (await context.params).id); }
