import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/colors", "/components", "/dimensions", "/fonts", "/layout"];

export async function middleware(request: NextRequest) {
  const { auth0 } = await import("./lib/auth0");
  const authRes = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  // Let Auth0 handle its own routes without interference
  if (pathname.startsWith("/auth")) {
    // Unlink garden session on logout
    if (pathname === "/auth/logout") {
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
    }
    return authRes;
  }

  // Protect registered-only routes
  if (PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.redirect(
        new URL(`/auth/login?returnTo=${pathname}`, request.url),
      );
    }
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
