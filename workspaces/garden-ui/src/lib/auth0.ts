import { loadEnvSecrets } from "@jaypie/aws";
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

// Lazy-initialize Auth0Client, ensuring secrets are loaded first.
// OpenNext/Lambda may dispatch requests before instrumentation register()
// completes, so we must guarantee secrets are in process.env ourselves.
let _auth0: Auth0Client | undefined;
let _secretsPromise: Promise<void> | undefined;

async function ensureSecrets(): Promise<void> {
  if (process.env.AUTH0_SECRET && process.env.AUTH0_CLIENT_SECRET) {
    return;
  }
  if (!_secretsPromise) {
    console.log("[auth0] Secrets missing, loading inline");
    _secretsPromise = loadEnvSecrets(
      "AUTH0_CLIENT_SECRET",
      "AUTH0_SECRET",
      "PROJECT_SALT",
    );
  }
  await _secretsPromise;
}

function createAuth0Client(): Auth0Client {
  console.log("[auth0] Creating Auth0Client", {
    hasAuth0ClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
    hasAuth0Domain: !!process.env.AUTH0_DOMAIN,
    hasAuth0Secret: !!process.env.AUTH0_SECRET,
    auth0SecretType: typeof process.env.AUTH0_SECRET,
    auth0SecretLength: process.env.AUTH0_SECRET?.length,
  });
  return new Auth0Client({
    allowInsecureRequests: process.env.NODE_ENV !== "production",
    appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3160",

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
}

async function getAuth0(): Promise<Auth0Client> {
  await ensureSecrets();
  if (!_auth0) {
    _auth0 = createAuth0Client();
  }
  return _auth0;
}

// Proxy defers all property access to the lazily-created Auth0Client.
// Methods become async-aware: any method call first awaits secrets, then delegates.
export const auth0 = new Proxy({} as Auth0Client, {
  get(_target, prop) {
    // Return an async wrapper for method calls that ensures secrets are loaded
    return async (...args: unknown[]) => {
      const instance = await getAuth0();
      const method = (instance as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof method === "function") {
        return (method as Function).apply(instance, args);
      }
      return method;
    };
  },
});
