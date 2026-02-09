import { initClient } from "@jaypie/dynamodb";
import { UnauthorizedError } from "@jaypie/errors";
import { expressHandler } from "jaypie";
import type { Request } from "express";

import { extractToken, validateApiKey } from "../apikey/index.js";

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
