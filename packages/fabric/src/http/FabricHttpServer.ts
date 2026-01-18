// FabricHttpServer - Standalone Lambda/server for multi-service HTTP routing

import { isJaypieError, JaypieError } from "@jaypie/errors";

import type { HttpServiceContext } from "./fabricHttp.js";
import { isFabricHttpService } from "./fabricHttp.js";
import {
  buildCorsHeaders,
  buildPreflightHeaders,
  isPreflightRequest,
  normalizeCorsConfig,
} from "./cors.js";
import { createHttpContext, transformHttpToInput } from "./httpTransform.js";
import type {
  ApiGatewayEvent,
  ApiGatewayResponse,
  ApiGatewayV1Event,
  ApiGatewayV2Event,
  AuthorizationConfig,
  CorsHeaders,
  CorsOption,
  DataResponse,
  ErrorResponse,
  FabricHttpServer as FabricHttpServerType,
  FabricHttpServerConfig,
  FabricHttpServerRoute,
  FabricHttpService,
  HttpMethod,
  RegisteredRoute,
  RouteMatch,
} from "./types.js";
import { DEFAULT_HTTP_METHODS } from "./types.js";

/**
 * Check if event is API Gateway v2 format
 */
function isApiGatewayV2Event(event: ApiGatewayEvent): event is ApiGatewayV2Event {
  return "requestContext" in event && "http" in (event as ApiGatewayV2Event).requestContext;
}

/**
 * Check if entry is a FabricHttpServerRoute (has service property)
 */
function isRouteConfig(
  entry: FabricHttpService | FabricHttpServerRoute,
): entry is FabricHttpServerRoute {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "service" in entry &&
    isFabricHttpService(entry.service)
  );
}

/**
 * Extract request data from API Gateway event (v1 or v2)
 */
function extractRequestData(event: ApiGatewayEvent): {
  body: string | null;
  headers: Record<string, string>;
  method: string;
  path: string;
  queryString: string;
  pathParams: Record<string, string>;
} {
  if (isApiGatewayV2Event(event)) {
    // API Gateway v2 (HTTP API)
    return {
      body: event.body ?? null,
      headers: event.headers ?? {},
      method: event.requestContext.http.method,
      path: event.rawPath,
      queryString: event.rawQueryString ?? "",
      pathParams: event.pathParameters ?? {},
    };
  } else {
    // API Gateway v1 (REST API)
    const v1Event = event as ApiGatewayV1Event;
    // Convert query params to query string
    const queryParams = v1Event.queryStringParameters ?? {};
    const queryString = new URLSearchParams(queryParams).toString();

    return {
      body: v1Event.body,
      headers: v1Event.headers ?? {},
      method: v1Event.httpMethod,
      path: v1Event.path,
      queryString,
      pathParams: v1Event.pathParameters ?? {},
    };
  }
}

/**
 * Match a request path against a route pattern
 * Returns extracted params if matched, undefined if not
 */
function matchRoute(
  requestPath: string,
  route: RegisteredRoute,
): Record<string, string> | undefined {
  const requestSegments = requestPath.split("/").filter(Boolean);
  const routeSegments = route.segments;

  // Check segment count (allow route to have optional params)
  if (requestSegments.length < routeSegments.filter((s) => !s.endsWith("?")).length) {
    return undefined;
  }
  if (requestSegments.length > routeSegments.length) {
    return undefined;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const requestSegment = requestSegments[i];

    if (routeSegment.startsWith(":")) {
      // Parameter segment
      const paramName = routeSegment.slice(1).replace("?", "");
      const isOptional = routeSegment.endsWith("?");

      if (requestSegment !== undefined) {
        params[paramName] = requestSegment;
      } else if (!isOptional) {
        return undefined; // Required param missing
      }
    } else {
      // Literal segment - must match exactly
      if (requestSegment !== routeSegment) {
        return undefined;
      }
    }
  }

  return params;
}

/**
 * Find matching route for a request
 */
function findRoute(
  path: string,
  method: string,
  routes: RegisteredRoute[],
  prefix?: string,
): RouteMatch | undefined {
  // Remove prefix from path if present
  let normalizedPath = path;
  if (prefix && normalizedPath.startsWith(prefix)) {
    normalizedPath = normalizedPath.slice(prefix.length) || "/";
  }

  // Find first matching route
  for (const route of routes) {
    // Check method first
    if (!route.methods.includes(method.toUpperCase() as HttpMethod)) {
      continue;
    }

    // Try to match path
    const params = matchRoute(normalizedPath, route);
    if (params !== undefined) {
      return { route, params };
    }
  }

  return undefined;
}

/**
 * Find route by path only (ignoring method) for 405 responses
 */
function findRouteByPath(
  path: string,
  routes: RegisteredRoute[],
  prefix?: string,
): RegisteredRoute | undefined {
  let normalizedPath = path;
  if (prefix && normalizedPath.startsWith(prefix)) {
    normalizedPath = normalizedPath.slice(prefix.length) || "/";
  }

  for (const route of routes) {
    const params = matchRoute(normalizedPath, route);
    if (params !== undefined) {
      return route;
    }
  }

  return undefined;
}

/**
 * Build API Gateway response
 */
function buildResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): ApiGatewayResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Apply CORS headers to response headers object
 */
function applyCorsHeaders(
  responseHeaders: Record<string, string>,
  corsHeaders: CorsHeaders,
): void {
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (value !== undefined) {
      responseHeaders[key] = value;
    }
  }
}

/**
 * Create a standalone HTTP server for Lambda
 *
 * Routes multiple FabricHttpService instances without Express:
 * - Parses API Gateway v1 and v2 events
 * - Matches routes by path pattern and HTTP method
 * - Handles CORS preflight and response headers
 * - Returns JSON:API formatted responses
 *
 * @example
 * ```typescript
 * import { FabricHttpServer } from "@jaypie/fabric/http";
 * import { lambdaHandler } from "@jaypie/lambda";
 *
 * const server = FabricHttpServer({
 *   services: [
 *     userService,
 *     { service: productService, path: "/products/:id", methods: ["GET", "PUT"] },
 *   ],
 *   prefix: "/api",
 * });
 *
 * export const handler = lambdaHandler(server);
 * ```
 */
export function FabricHttpServer(
  config: FabricHttpServerConfig,
): FabricHttpServerType {
  const {
    services,
    authorization: serverAuthorization,
    cors: serverCors = true,
    prefix,
  } = config;

  // Build routes from services
  const routes: RegisteredRoute[] = [];
  const registeredServices: FabricHttpService[] = [];

  for (const entry of services) {
    let service: FabricHttpService;
    let path: string | undefined;
    let methods: HttpMethod[] | undefined;

    if (isRouteConfig(entry)) {
      service = entry.service;
      path = entry.path;
      methods = entry.methods;
    } else if (isFabricHttpService(entry)) {
      service = entry;
    } else {
      throw new Error(
        "FabricHttpServer: Each service entry must be a FabricHttpService or { service: FabricHttpService }",
      );
    }

    // Determine path from config or service alias
    const routePath = path ?? (service.alias ? `/${service.alias}` : "/");

    // Parse route segments
    const segments = routePath.split("/").filter(Boolean);

    routes.push({
      path: routePath,
      segments,
      methods: methods ?? DEFAULT_HTTP_METHODS,
      service,
    });

    registeredServices.push(service);
  }

  // Normalize server-level CORS config
  const serverCorsConfig = normalizeCorsConfig(serverCors);

  /**
   * Main request handler
   */
  const handler = async (event: ApiGatewayEvent): Promise<ApiGatewayResponse> => {
    // Extract request data from API Gateway event
    const { body, headers, method, path: requestPath, queryString, pathParams } =
      extractRequestData(event);

    // Normalize headers to Headers object for consistency
    const headersObj = new Headers(headers);
    const origin = headersObj.get("origin");

    // Collect all methods for matched path (for 405 and OPTIONS)
    const pathRoute = findRouteByPath(requestPath, routes, prefix);
    const allowedMethods = pathRoute?.methods ?? [];

    // Handle CORS preflight
    if (isPreflightRequest(method, headersObj)) {
      const preflightHeaders = buildPreflightHeaders(
        serverCorsConfig,
        origin,
        headersObj.get("access-control-request-method"),
        headersObj.get("access-control-request-headers"),
        allowedMethods.length > 0 ? allowedMethods : DEFAULT_HTTP_METHODS,
      );

      const responseHeaders: Record<string, string> = {};
      applyCorsHeaders(responseHeaders, preflightHeaders);

      return {
        statusCode: 204,
        headers: responseHeaders,
        body: "",
      };
    }

    // Build CORS headers for response
    const corsHeaders = buildCorsHeaders(serverCorsConfig, origin, allowedMethods);
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    applyCorsHeaders(responseHeaders, corsHeaders);

    // Find matching route
    const match = findRoute(requestPath, method, routes, prefix);

    // 404 - No route found
    if (!match && !pathRoute) {
      const errorResponse: ErrorResponse = {
        errors: [
          {
            status: 404,
            title: "Not Found",
            detail: `No route matches ${requestPath}`,
          },
        ],
      };
      return buildResponse(404, errorResponse, responseHeaders);
    }

    // 405 - Path exists but method not allowed
    if (!match && pathRoute) {
      const errorResponse: ErrorResponse = {
        errors: [
          {
            status: 405,
            title: "Method Not Allowed",
            detail: `${method} is not allowed for ${requestPath}`,
          },
        ],
      };
      responseHeaders["Allow"] = pathRoute.methods.join(", ");
      return buildResponse(405, errorResponse, responseHeaders);
    }

    // We have a match
    const { route, params } = match!;
    const service = route.service;

    try {
      // Create HTTP context
      const httpContext = createHttpContext({
        body,
        headers,
        method,
        path: requestPath,
        queryString,
        params: { ...pathParams, ...params },
      });

      // Transform to service input
      const input = await transformHttpToInput(httpContext, service.http);

      // Build service context
      const serviceContext: HttpServiceContext = {
        http: httpContext,
      };

      // Call the service
      const result = await service(input, serviceContext);

      // Build success response
      const successResponse: DataResponse = {
        data: result,
      };

      return buildResponse(200, successResponse, responseHeaders);
    } catch (error) {
      // Handle errors
      const jaypieError = isJaypieError(error);
      const status = jaypieError ? (error as JaypieError).status : 500;
      const title = jaypieError
        ? (error as JaypieError).title
        : "Internal Server Error";
      const detail = error instanceof Error ? error.message : String(error);

      const errorResponse: ErrorResponse = {
        errors: [
          {
            status,
            title,
            detail: status === 500 ? undefined : detail,
          },
        ],
      };

      return buildResponse(status, errorResponse, responseHeaders);
    }
  };

  // Attach metadata to handler
  const server = handler as FabricHttpServerType;
  server.services = registeredServices;
  server.prefix = prefix;
  server.routes = routes;

  return server;
}

/**
 * Check if a value is a FabricHttpServer
 */
export function isFabricHttpServer(
  value: unknown,
): value is FabricHttpServerType {
  return (
    typeof value === "function" &&
    "services" in value &&
    Array.isArray((value as FabricHttpServerType).services) &&
    "routes" in value &&
    Array.isArray((value as FabricHttpServerType).routes)
  );
}
