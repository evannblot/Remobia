import { getOwnerAuth, getOwnerAuthOrigin, getOwnerAuthRedirectOrigin } from "../../../lib/admin-auth";
import { ownerLoginResponse } from "../../../lib/owner-login.mjs";
import { ownerCodeResponse } from "../../../lib/owner-code.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context, method: "GET" | "POST") {
  const path = (await context.params).path;
  const endpoint = path.join("/");
  if (method === "GET" && endpoint === "owner-login" && process.env.OWNER_GOOGLE_LOGIN_ENABLED !== "true") {
    return new Response(null, { status: 303, headers: {
      Location: new URL("/connexion?erreur=connexion", request.url).href, "Cache-Control": "no-store",
    } });
  }
  if (endpoint === "sign-in/social" && process.env.OWNER_GOOGLE_LOGIN_ENABLED !== "true") {
    return Response.json({ error: "Utilisez la connexion par code email." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  // Public OTP requests must use the owner-only wrapper. The wrapper delegates
  // directly to the SDK, without traversing this route again.
  if (["email-otp/send-verification-otp", "sign-in/email-otp"].includes(endpoint)) {
    return Response.json({ error: "Utilisez le formulaire de connexion propriétaire." }, {
      status: 404, headers: { "Cache-Control": "no-store" },
    });
  }
  const auth = getOwnerAuth();
  if (!auth) return Response.json({ error: "La connexion propriétaire est en cours de configuration." }, {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
  if (endpoint === "owner-code") {
    return ownerCodeResponse(request, (post: Request, providerPath: string[]) => auth.handler().POST(post, {
      params: Promise.resolve({ path: providerPath }),
    }), process.env.SITE_ADMIN_EMAIL);
  }
  if (method === "GET" && endpoint === "owner-login") {
    return ownerLoginResponse(request, (post: Request) => auth.handler().POST(post, {
      params: Promise.resolve({ path: ["sign-in", "social"] }),
    }), getOwnerAuthOrigin(), getOwnerAuthRedirectOrigin());
  }
  return auth.handler()[method](request, context);
}
export async function GET(request: Request, context: Context) { return handle(request, context, "GET"); }
export async function POST(request: Request, context: Context) { return handle(request, context, "POST"); }
