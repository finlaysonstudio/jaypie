import { initClient } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

import { hashKey } from "../../../lib/apikey/generate";
import { extractToken, validateApiKey } from "../../../lib/apikey/validate";
import { createSession, SESSION_TTL_MS } from "../../../lib/session/create";

//
//
// Constants
//

const COOKIE_NAME = "garden-session";
const COOKIE_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);

//
//
// Handlers
//

export async function POST(request: Request): Promise<Response> {
  try {
    initClient({
      endpoint: process.env.DYNAMODB_ENDPOINT,
    });
  } catch (error) {
    log.error("Failed to initialize DynamoDB client", { error });
    return Response.json(
      { error: "Database connection failed" },
      { status: 500 },
    );
  }

  // Extract and validate API key from Bearer token
  const authorization = request.headers.get("authorization") ?? undefined;
  const token = extractToken(authorization);

  if (!token) {
    return Response.json({ error: "Missing authorization" }, { status: 401 });
  }

  let level: string;
  try {
    const result = await validateApiKey(token);
    level = result.level;
  } catch {
    return Response.json({ error: "Invalid API key" }, { status: 403 });
  }

  // Create session
  const apikeyHash = hashKey(token);
  const session = await createSession({ apikeyHash, level });

  // Set httpOnly cookie and return session token
  const cookieValue = [
    `${COOKIE_NAME}=${session.token}`,
    `HttpOnly`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    `Path=/`,
    `SameSite=Strict`,
    `Secure`,
  ].join("; ");

  return Response.json(
    { hint: session.hint, level: session.level, token: session.token },
    {
      headers: {
        "Set-Cookie": cookieValue,
      },
    },
  );
}

export async function DELETE(): Promise<Response> {
  // Clear the httpOnly cookie
  const cookieValue = [
    `${COOKIE_NAME}=`,
    `HttpOnly`,
    `Max-Age=0`,
    `Path=/`,
    `SameSite=Strict`,
    `Secure`,
  ].join("; ");

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": cookieValue,
      },
    },
  );
}
