import { adminBindings } from "../../../../lib/admin-auth";
import { env } from "cloudflare:workers";
import { createCatalogHandlers } from "../../../../lib/catalog-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) { return createCatalogHandlers(await adminBindings(env)).PUT(request, (await context.params).id); }
export async function DELETE(request: Request, context: Context) { return createCatalogHandlers(await adminBindings(env)).DELETE(request, (await context.params).id); }
