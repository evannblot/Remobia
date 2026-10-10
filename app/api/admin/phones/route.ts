import { adminBindings } from "../../../lib/admin-auth";
import { env } from "cloudflare:workers";
import { createCatalogHandlers } from "../../../lib/catalog-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) { return createCatalogHandlers(await adminBindings(env)).ADMIN_GET(request); }
export async function POST(request: Request) { return createCatalogHandlers(await adminBindings(env)).POST(request); }
