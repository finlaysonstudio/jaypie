import type { NextRequest } from "next/server";

import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  // Handle logout: unlink session before Auth0 processes it
  if (request.nextUrl.pathname === "/auth/logout") {
    const sessionCookie = request.cookies.get("garden-session")?.value;
    if (sessionCookie) {
      try {
        const { initClient } = await import("@jaypie/dynamodb");
        const { unlinkSession } = await import("./lib/session");

        initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
        await unlinkSession(sessionCookie);
      } catch {
        // Best effort — don't block logout
      }
    }
    return authRes;
  }

  // Create garden session on first visit
  const hasSession = request.cookies.has("garden-session");
  if (!hasSession) {
    try {
      const { initClient } = await import("@jaypie/dynamodb");
      const {
        COOKIE_MAX_AGE,
        COOKIE_NAME,
        createSession,
      } = await import("./lib/session");

      initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
      const token = await createSession();

      authRes.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } catch {
      // Best effort — don't block the request
    }
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
