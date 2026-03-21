import { APEX, initClient, queryByScope } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

import { extractToken, validateApiKey } from "../../lib/apikey/validate";
import { getAuthMode } from "../../lib/authMode";
import { isSessionToken, validateSession } from "../../lib/session/validate";

//
//
// Types
//

interface StatusError {
  detail: string;
  status: number;
  title: string;
}

interface StatusMessage {
  content: string;
  level: string;
  type: string;
}

interface StatusResponse {
  authenticated: boolean;
  errors?: StatusError[];
  initialized?: boolean;
  messages?: StatusMessage[];
  mode: "auth0" | "bypass";
  status: string;
  user?: { email?: string; name?: string };
}

//
//
// Handler
//

export async function GET(request: Request): Promise<Response> {
  const mode = getAuthMode();

  // Auth0 mode: check Auth0 session
  if (mode === "auth0") {
    try {
      const { auth0 } = await import("../../lib/auth0");
      const session = await auth0.getSession();
      const authenticated = !!session;

      const body: StatusResponse = {
        authenticated,
        mode,
        status: "ok",
        ...(session?.user
          ? { user: { email: session.user.email, name: session.user.name } }
          : {}),
      };
      return Response.json(body);
    } catch (error) {
      log.error("Failed to check Auth0 session", { error });
      const body: StatusResponse = {
        authenticated: false,
        errors: [
          {
            detail: "Unable to check authentication status",
            status: 500,
            title: "Auth Error",
          },
        ],
        mode,
        status: "error",
      };
      return Response.json(body, { status: 500 });
    }
  }

  // Bypass mode: existing DynamoDB logic
  try {
    initClient({
      endpoint: process.env.DYNAMODB_ENDPOINT,
    });
  } catch (error) {
    log.error("Failed to initialize DynamoDB client", { error });
    const body: StatusResponse = {
      authenticated: false,
      errors: [
        {
          detail: "Unable to connect to database",
          status: 500,
          title: "Database Error",
        },
      ],
      mode,
      status: "error",
    };
    return Response.json(body, { status: 500 });
  }

  // Check initialized: are there any apikey records?
  let initialized = false;
  try {
    const { items } = await queryByScope({
      limit: 1,
      model: "apikey",
      scope: APEX,
    });
    initialized = items.length > 0;
  } catch (error) {
    log.error("Failed to query DynamoDB for initialization status", { error });
    const body: StatusResponse = {
      authenticated: false,
      errors: [
        {
          detail: "Unable to check initialization status",
          status: 500,
          title: "Database Error",
        },
      ],
      mode,
      status: "error",
    };
    return Response.json(body, { status: 500 });
  }

  // Check authenticated: cookie first, then Bearer token
  let authenticated = false;

  // 1. Check httpOnly cookie (XSS-safe)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/garden-session=([^\s;]+)/);
  const cookieToken = cookieMatch?.[1];

  if (cookieToken && isSessionToken(cookieToken)) {
    try {
      await validateSession(cookieToken);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  // 2. Check Bearer token (session or API key)
  if (!authenticated) {
    const authorization = request.headers.get("authorization") ?? undefined;
    const token = extractToken(authorization);

    if (token) {
      try {
        if (isSessionToken(token)) {
          await validateSession(token);
        } else {
          await validateApiKey(token);
        }
        authenticated = true;
      } catch {
        authenticated = false;
      }
    }
  }

  // Not initialized → warn (but still check auth for seed bootstrap)
  if (!initialized && !authenticated) {
    const body: StatusResponse = {
      authenticated: false,
      initialized: false,
      messages: [
        {
          content: "Garden has not been initialized. No API keys found.",
          level: "warn",
          type: "text",
        },
      ],
      mode,
      status: "warn",
    };
    return Response.json(body);
  }

  const body: StatusResponse = {
    authenticated,
    mode,
    status: "ok",
  };

  return Response.json(body);
}
