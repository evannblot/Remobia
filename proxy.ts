import { NextResponse, type NextRequest } from "next/server";
import { getOwnerAuth } from "./app/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const auth = getOwnerAuth();
  return auth ? auth.middleware({ loginUrl: "/connexion" })(request) : NextResponse.next();
}
export const config = { matcher: ["/gestion/:path*", "/connexion", "/api/auth/:path*"] };
