import { NotImplementedError } from "@jaypie/errors";
import { HTTP } from "@jaypie/kit";

import expressHandler from "./expressHandler.js";
import httpHandler from "./http.handler.js";
import echoHandler from "./echo.handler.js";

//
//
// Functions
//

const routes = {
  badRequestRoute: httpHandler(HTTP.CODE.BAD_REQUEST, { name: "_badRequest" }),
  echoRoute: echoHandler(),
  forbiddenRoute: httpHandler(HTTP.CODE.FORBIDDEN, { name: "_forbidden" }),
  goneRoute: httpHandler(HTTP.CODE.GONE, { name: "_gone" }),
  methodNotAllowedRoute: httpHandler(HTTP.CODE.METHOD_NOT_ALLOWED, {
    name: "_methodNotAllowed",
  }),
  noContentRoute: httpHandler(HTTP.CODE.NO_CONTENT, { name: "_noContent" }),
  notFoundRoute: httpHandler(HTTP.CODE.NOT_FOUND, { name: "_notFound" }),
  notImplementedRoute: expressHandler(
    (): never => {
      throw new NotImplementedError();
    },
    { name: "_notImplemented" },
  ),
};

//
//
// Export
//

export const badRequestRoute = routes.badRequestRoute;
export const echoRoute = routes.echoRoute;
export const forbiddenRoute = routes.forbiddenRoute;
export const goneRoute = routes.goneRoute;
export const methodNotAllowedRoute = routes.methodNotAllowedRoute;
export const noContentRoute = routes.noContentRoute;
export const notFoundRoute = routes.notFoundRoute;
export const notImplementedRoute = routes.notImplementedRoute;
