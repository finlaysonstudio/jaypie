import { initClient } from "@jaypie/dynamodb";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth0 } from "./lib/auth0";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createSession,
  unlinkSession,
} from "./lib/session";

//
//
// Constants
//

const PROTECTED_PATHS = ["/apikeys", "/colors", "/components", "/dimensions", "/fonts", "/layout", "/records"];

//
//
// Helpers
//

function ensureClient() {
  initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
}

//
//
// Middleware
//

export async function middleware(request: NextRequest) {
  // Skip all auth when bypass is enabled (local dev)
  if (process.env.DANGEROUS_BYPASS_AUTHENTICATION === "true") {
    const response = NextResponse.next();

    // Still create garden session on first visit
    if (!request.cookies.has(COOKIE_NAME)) {
      try {
        ensureClient();
        const token = await createSession();
        response.cookies.set(COOKIE_NAME, token, {
          httpOnly: true,
          maxAge: COOKIE_MAX_AGE,
          path: "/",
          sameSite: "lax",
          secure: false,
        });
      } catch {
        // Best effort
      }
    }

    return response;
  }

  const authRes = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  // Let Auth0 handle its own routes without interference
  if (pathname.startsWith("/auth")) {
    // Unlink garden session on logout
    if (pathname === "/auth/logout") {
      const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
      if (sessionCookie) {
        try {
          ensureClient();
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
  if (!request.cookies.has(COOKIE_NAME)) {
    try {
      ensureClient();
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

export const runtime = "nodejs";
