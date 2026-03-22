import { initClient } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { getAuthMode } from "./authMode";
import { upsertUser } from "./user/upsert";

export const auth0 = new Auth0Client({
  allowInsecureRequests: process.env.NODE_ENV !== "production",

  async onCallback(error, context, session) {
    if (error) {
      log.error("Auth0 callback error", { error });
      return NextResponse.redirect(
        new URL("/", process.env.APP_BASE_URL),
      );
    }

    if (session && getAuthMode() === "auth0") {
      try {
        initClient({
          endpoint: process.env.DYNAMODB_ENDPOINT,
        });
        await upsertUser({
          email: session.user.email ?? "",
          name: session.user.name ?? "",
          sub: session.user.sub,
        });
      } catch (err) {
        log.error("Failed to upsert user on login", { error: err });
      }
    }

    return NextResponse.redirect(
      new URL(context.returnTo || "/", process.env.APP_BASE_URL),
    );
  },
});
