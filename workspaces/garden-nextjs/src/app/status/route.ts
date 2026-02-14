import { APEX, initClient, queryByScope } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

import { extractToken, validateApiKey } from "../../lib/apikey/validate.js";

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
  initiated?: boolean;
  messages?: StatusMessage[];
  status: string;
}

//
//
// Handler
//

export async function GET(request: Request): Promise<Response> {
  try {
    initClient();
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

  // Check initiated: are there any apikey records?
  let initiated = false;
  try {
    const { items } = await queryByScope({
      limit: 1,
      model: "apikey",
      scope: APEX,
    });
    initiated = items.length > 0;
  } catch (error) {
    log.error("Failed to query DynamoDB for initiation status", { error });
    const body: StatusResponse = {
      authenticated: false,
      errors: [
        {
          detail: "Unable to check initiation status",
          status: 500,
          title: "Database Error",
        },
      ],
      status: "error",
    };
    return Response.json(body, { status: 500 });
  }

  // Not initiated → warn
  if (!initiated) {
    const body: StatusResponse = {
      authenticated: false,
      initiated: false,
      messages: [
        {
          content: "Garden has not been initiated. No API keys found.",
          level: "warn",
          type: "text",
        },
      ],
      status: "warn",
    };
    return Response.json(body);
  }

  // Check authenticated: validate Bearer token
  let authenticated = false;
  const authorization = request.headers.get("authorization") ?? undefined;
  const token = extractToken(authorization);

  if (token) {
    try {
      await validateApiKey(token);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  const body: StatusResponse = {
    authenticated,
    status: "ok",
  };

  return Response.json(body);
}
