import type { NextFunction, Request, Response } from "express";

import { isFabricHttpService } from "../http/fabricHttp.js";
import type { HttpServiceContext } from "../http/fabricHttp.js";
import {
  buildCorsHeaders,
  buildPreflightHeaders,
  isPreflightRequest,
  normalizeCorsConfig,
} from "../http/cors.js";
import {
  createHttpContext,
  transformHttpToInput,
} from "../http/httpTransform.js";
import type { CorsHeaders, HttpContext, HttpMethod } from "../http/types.js";
import { DEFAULT_HTTP_METHODS } from "../http/types.js";

import type { FabricExpressConfig, FabricExpressMiddleware } from "./types.js";

/**
 * Convert Express request headers to Headers object
 */
function expressHeadersToHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        // Join array headers with comma
        headers.set(key, value.join(", "));
      } else {
        headers.set(key, value);
      }
    }
  }
  return headers;
}

/**
 * Create HTTP context from Express request
 */
function createHttpContextFromExpress(
  req: Request,
  pathPattern?: string,
): HttpContext {
  const headers = expressHeadersToHeaders(req);

  // Build query string from Express query object
  const queryString = new URLSearchParams(
    req.query as Record<string, string>,
  ).toString();

  return createHttpContext({
    body: req.body,
    headers,
    method: req.method,
    path: req.path,
    queryString,
    params: req.params as Record<string, string>,
  });
}

/**
 * Send JSON:API success response
 */
function sendDataResponse<T>(res: Response, data: T, statusCode = 200): void {
  if (data === null || data === undefined) {
    res.status(204).send();
    return;
  }

  res.status(statusCode).json({ data });
}

/**
 * Send JSON:API error response
 */
function sendErrorResponse(
  res: Response,
  error: Error & { status?: number; title?: string },
): void {
  const status = error.status ?? 500;
  const title = error.title ?? error.name ?? "Internal Server Error";
  const detail = error.message;

  res.status(status).json({
    errors: [
      {
        detail,
        status,
        title,
      },
    ],
  });
}

/**
 * Apply CORS headers to response
 */
function applyCorsHeaders(res: Response, corsHeaders: CorsHeaders): void {
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (value !== undefined) {
      res.set(key, value);
    }
  }
}

/**
 * Create Express middleware from a fabric HTTP service
 *
 * Wraps a FabricHttpService for use with Express:
 * - Extracts HTTP context from Express request
 * - Handles CORS preflight requests
 * - Transforms input using the service's http function
 * - Calls the service with transformed input
 * - Sends response in JSON:API format
 */
export function fabricExpress<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
>(
  config: FabricExpressConfig<TInput, TOutput, TAuth>,
): FabricExpressMiddleware {
  const { service, methods = DEFAULT_HTTP_METHODS } = config;

  // Validate service
  if (!isFabricHttpService(service)) {
    throw new Error(
      "fabricExpress requires a FabricHttpService. Use fabricHttp() to create one.",
    );
  }

  // Determine path from config or service alias
  const path = config.path ?? `/${service.alias ?? ""}`;

  // Normalize CORS configuration
  const corsConfig = normalizeCorsConfig(service.cors);

  // Create the middleware function
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Create HTTP context from Express request
      const httpContext = createHttpContextFromExpress(req, path);

      // Get request origin for CORS
      const requestOrigin = req.get("origin") ?? null;

      // Handle CORS preflight
      if (isPreflightRequest(req.method, httpContext.headers)) {
        const preflightHeaders = buildPreflightHeaders(
          corsConfig,
          requestOrigin,
          req.get("access-control-request-method") ?? null,
          req.get("access-control-request-headers") ?? null,
          methods,
        );
        applyCorsHeaders(res, preflightHeaders);
        res.status(204).send();
        return;
      }

      // Apply CORS headers to response
      const corsHeaders = buildCorsHeaders(corsConfig, requestOrigin, methods);
      applyCorsHeaders(res, corsHeaders);

      // Check if method is allowed
      if (!methods.includes(req.method.toUpperCase() as HttpMethod)) {
        res.status(405).json({
          errors: [
            {
              detail: `Method ${req.method} not allowed`,
              status: 405,
              title: "Method Not Allowed",
            },
          ],
        });
        return;
      }

      // Transform HTTP context to service input
      const input = await transformHttpToInput<TInput>(
        httpContext,
        service.http,
      );

      // Create service context with HTTP info
      const serviceContext: HttpServiceContext<TAuth> = {
        http: httpContext,
      };

      // Call the service
      const result = await service(input, serviceContext);

      // Send response
      sendDataResponse(res, result);
    } catch (error) {
      // Send error response
      sendErrorResponse(res, error as Error);
    }
  };

  // Attach metadata to middleware
  const expressMiddleware = middleware as FabricExpressMiddleware;
  expressMiddleware.service = service;
  expressMiddleware.path = path;
  expressMiddleware.methods = methods;

  return expressMiddleware;
}

/**
 * Check if a value is a FabricExpressMiddleware
 */
export function isFabricExpressMiddleware(
  value: unknown,
): value is FabricExpressMiddleware {
  return (
    typeof value === "function" &&
    "service" in value &&
    "path" in value &&
    "methods" in value
  );
}
