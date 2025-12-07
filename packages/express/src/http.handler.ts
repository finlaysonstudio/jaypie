import type { Request, Response } from "express";
import {
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  HTTP,
  InternalError,
  log,
  MethodNotAllowedError,
  NotFoundError,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
} from "@jaypie/core";

import expressHandler, { ExpressHandlerOptions } from "./expressHandler.js";

//
//
// Types
//

type ErrorConstructor = new () => Error;

//
//
// Main
//

const httpHandler = (
  statusCode: number = HTTP.CODE.OK,
  context: ExpressHandlerOptions = {},
): ((
  req: Request,
  res: Response,
) => Promise<Record<string, unknown> | null>) => {
  // Give a default name if there isn't one
  if (!context.name) {
    context.name = "_http";
  }

  // Return a function that will be used as an express route
  return expressHandler(
    async (
      req: Request,
      res: Response,
    ): Promise<Record<string, unknown> | null> => {
      // Map the most throwable status codes to errors and throw them!
      const error: Record<number, ErrorConstructor> = {
        [HTTP.CODE.BAD_REQUEST]: BadRequestError,
        [HTTP.CODE.UNAUTHORIZED]: UnauthorizedError,
        [HTTP.CODE.FORBIDDEN]: ForbiddenError,
        [HTTP.CODE.NOT_FOUND]: NotFoundError,
        [HTTP.CODE.METHOD_NOT_ALLOWED]: MethodNotAllowedError,
        [HTTP.CODE.GONE]: GoneError,
        [HTTP.CODE.TEAPOT]: TeapotError,
        [HTTP.CODE.INTERNAL_ERROR]: InternalError,
        [HTTP.CODE.BAD_GATEWAY]: BadGatewayError,
        [HTTP.CODE.UNAVAILABLE]: UnavailableError,
        [HTTP.CODE.GATEWAY_TIMEOUT]: GatewayTimeoutError,
      };

      // If this maps to an error, throw it
      if (error[statusCode]) {
        log.trace(
          `@knowdev/express: gracefully throwing ${statusCode} up to projectHandler`,
        );
        throw new error[statusCode]();
      }

      // If this is an error and we didn't get thrown, log a warning
      if (statusCode >= 400) {
        log.warn(
          `@knowdev/express: status code ${statusCode} not mapped as throwable`,
        );
      }

      // Send the response
      res.status(statusCode);
      return statusCode === HTTP.CODE.NO_CONTENT ? null : {};
    },
    context,
  );
};

//
//
// Export
//

export default httpHandler;
