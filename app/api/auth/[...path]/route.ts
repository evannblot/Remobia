import { getOwnerAuth, getOwnerAuthOrigin, getOwnerAuthRedirectOrigin } from "../../../lib/admin-auth";
import { ownerLoginResponse } from "../../../lib/owner-login.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context, method: "GET" | "POST") {
  const auth = getOwnerAuth();
  if (!auth) return Response.json({ error: "La connexion propriétaire est en cours de configuration." }, { status: 503 });
  const path = (await context.params).path;
  if (method === "GET" && path.join("/") === "owner-login") {
    return ownerLoginResponse(request, (post: Request) => auth.handler().POST(post, {
      params: Promise.resolve({ path: ["sign-in", "social"] }),
    }), getOwnerAuthOrigin(), getOwnerAuthRedirectOrigin());
  }
  return auth.handler()[method](request, context);
}
export async function GET(request: Request, context: Context) { return handle(request, context, "GET"); }
export async function POST(request: Request, context: Context) { return handle(request, context, "POST"); }
