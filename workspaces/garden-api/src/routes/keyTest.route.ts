import { initClient } from "@jaypie/dynamodb";
import { UnauthorizedError } from "@jaypie/errors";
import { expressHandler } from "jaypie";
import type { Request } from "express";

import { extractToken, validateApiKey } from "../apikey/index.js";
import { isSessionToken, validateSession } from "../session/validate.js";

//
//
// Main
//

const keyTestRoute = expressHandler(
  async (req: Request) => {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError();
    }
    if (isSessionToken(token)) {
      return await validateSession(token);
    }
    return await validateApiKey(token);
  },
  {
    name: "keyTest",
    secrets: ["PROJECT_ADMIN_SEED"],
    setup: () => {
      initClient();
    },
  },
);

//
//
// Export
//

export default keyTestRoute;
