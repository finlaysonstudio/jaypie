import type { Request, Response } from "express";
import { BadRequestError } from "@jaypie/errors";

import expressHandler, { ExpressHandlerOptions } from "./expressHandler.js";
import summarizeRequest from "./summarizeRequest.helper.js";

//
//
// Types
//

export interface EchoResponse {
  req: ReturnType<typeof summarizeRequest>;
}

//
//
// Main
//

const echoHandler = (
  context: ExpressHandlerOptions = {},
): ((req: Request, res: Response) => Promise<EchoResponse>) => {
  if (
    typeof context !== "object" ||
    context === null ||
    Array.isArray(context)
  ) {
    throw new BadRequestError(
      `Argument "${context}" doesn't match type "object"`,
    );
  }
  // Give a default name if there isn't one
  if (!context.name) {
    context.name = "_echo";
  }

  // Return a function that will be used as an express route
  return expressHandler(async (req: Request): Promise<EchoResponse> => {
    return {
      req: summarizeRequest(req),
    };
  }, context);
};

//
//
// Export
//

export default echoHandler;
