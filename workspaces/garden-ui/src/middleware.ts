import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthMode } from "./lib/authMode";

export async function middleware(request: NextRequest) {
  if (getAuthMode() === "bypass") {
    return NextResponse.next();
  }

  const { auth0 } = await import("./lib/auth0");
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
