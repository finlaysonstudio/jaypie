import { APEX, initClient, queryByScope } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

import { extractToken, validateApiKey } from "../../lib/apikey/validate";
import { isSessionToken, validateSession } from "../../lib/session/validate";

//
//
// Types
//

interface StatusMessage {
  content: string;
  level: string;
  type: string;
}

interface StatusError {
  detail: string;
  status: number;
  title: string;
}

interface StatusResponse {
  authenticated: boolean;
  errors?: StatusError[];
  initialized?: boolean;
  messages?: StatusMessage[];
  status: string;
}

//
//
// Handler
//

export async function GET(request: Request): Promise<Response> {
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
      status: "warn",
    };
    return Response.json(body);
  }

  const body: StatusResponse = {
    authenticated,
    status: "ok",
  };

  return Response.json(body);
}
