import { initClient } from "@jaypie/dynamodb";
import { UnauthorizedError } from "@jaypie/errors";
import { expressHandler } from "jaypie";
import type { Request } from "express";

import { extractToken, validateApiKey } from "@jaypie/garden-models";

//
//
// Main
//

const apikeyValidateRoute = expressHandler(
  async (req: Request) => {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError();
    }
    return await validateApiKey(token);
  },
  {
    name: "apikeyValidate",
    secrets: ["PROJECT_SALT"],
    setup: () => {
      initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    },
  },
);

//
//
// Export
//

export default apikeyValidateRoute;
