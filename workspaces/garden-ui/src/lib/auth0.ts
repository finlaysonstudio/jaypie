import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

export const auth0 = new Auth0Client({
  allowInsecureRequests: process.env.NODE_ENV !== "production",

  async onCallback(error, context, session) {
    // Run side effects but never let them break the callback
    if (!error && session) {
      try {
        const { initClient } = await import("@jaypie/dynamodb");
        const { upsertUser } = await import("./user/upsert");
        const { linkSession } = await import("./session");

        initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });

        await upsertUser({
          email: session.user.email ?? "",
          name: session.user.name ?? "",
          sub: session.user.sub,
        });

        // Link garden session to user
        try {
          const { cookies: getCookies } = await import("next/headers");
          const cookieStore = await getCookies();
          const sessionToken = cookieStore.get("garden-session")?.value;
          if (sessionToken) {
            await linkSession(sessionToken, {
              email: session.user.email ?? "",
              sub: session.user.sub,
            });
          }
        } catch {
          // cookies() may not be available in this context
        }
      } catch {
        // Best effort — don't break the auth flow
      }
    }

    // Always redirect
    const returnTo = context?.returnTo || "/";
    const base = process.env.APP_BASE_URL || "http://localhost:3160";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});
