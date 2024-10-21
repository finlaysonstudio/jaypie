import { HTTP, NotImplementedError } from "@jaypie/core";
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
    () => {
      throw new NotImplementedError();
    },
    { name: "_notImplemented" },
  ),
};

//
//
// Export
//

export const {
  badRequestRoute,
  echoRoute,
  forbiddenRoute,
  goneRoute,
  methodNotAllowedRoute,
  noContentRoute,
  notFoundRoute,
  notImplementedRoute,
} = routes;
