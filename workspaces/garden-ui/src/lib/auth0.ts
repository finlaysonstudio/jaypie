import { initClient } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { linkSession } from "./session";
import { upsertUser } from "./user/upsert";

//
//
// Helpers
//

function ensureClient() {
  initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
}

//
//
// Main
//

export const auth0 = new Auth0Client({
  allowInsecureRequests: process.env.NODE_ENV !== "production",

  async onCallback(error, context, session) {
    if (!error && session) {
      try {
        ensureClient();

        await upsertUser({
          email: session.user.email ?? "",
          name: session.user.name ?? "",
          sub: session.user.sub,
        });

        // Link garden session to user
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get("garden-session")?.value;
        if (sessionToken) {
          await linkSession(sessionToken, {
            email: session.user.email ?? "",
            sub: session.user.sub,
          });
        }
      } catch (err) {
        log.error("Failed to upsert user on login", { error: err });
      }
    }

    const returnTo = context?.returnTo || "/";
    const base = process.env.APP_BASE_URL || "http://localhost:3160";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});
