import { getOwnerAuth } from "../../../lib/admin-auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context, method: "GET" | "POST") {
  const auth = getOwnerAuth();
  if (!auth) return Response.json({ error: "La connexion propriétaire est en cours de configuration." }, { status: 503 });
  return auth.handler()[method](request, context);
}
export async function GET(request: Request, context: Context) { return handle(request, context, "GET"); }
export async function POST(request: Request, context: Context) { return handle(request, context, "POST"); }
