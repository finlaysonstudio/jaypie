import type { Request, Response } from "express";
import { validate } from "@jaypie/core";

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
  validate.object(context);
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
