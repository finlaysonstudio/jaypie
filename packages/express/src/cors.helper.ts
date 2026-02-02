import type { Request, Response, NextFunction } from "express";
import { CorsError } from "@jaypie/errors";
import { envBoolean, force } from "@jaypie/kit";
import expressCors from "cors";

//
//
// Constants
//

const HTTP_PROTOCOL = "http://";
const HTTPS_PROTOCOL = "https://";
const SANDBOX_ENV = "sandbox";

//
//
// Types
//

export interface CorsConfig {
  origin?: string | string[];
  overrides?: Record<string, unknown>;
}

type CorsCallback = (err: Error | null, allow?: boolean) => void;

//
//
// Helper Functions
//

const ensureProtocol = (url: string | undefined): string | undefined => {
  if (!url) return url;
  if (url.startsWith(HTTP_PROTOCOL) || url.startsWith(HTTPS_PROTOCOL))
    return url;
  return HTTPS_PROTOCOL + url;
};

const extractHostname = (origin: string): string | undefined => {
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return undefined;
  }
};

const isOriginAllowed = (requestOrigin: string, allowed: string): boolean => {
  const normalizedAllowed = ensureProtocol(allowed) as string;
  const normalizedRequest = ensureProtocol(requestOrigin) as string;

  const allowedHostname = extractHostname(normalizedAllowed);
  const requestHostname = extractHostname(normalizedRequest);

  if (!allowedHostname || !requestHostname) {
    return false;
  }

  // Exact match
  if (requestHostname === allowedHostname) {
    return true;
  }

  // Subdomain match
  if (requestHostname.endsWith(`.${allowedHostname}`)) {
    return true;
  }

  return false;
};

export const dynamicOriginCallbackHandler = (
  origin?: string | string[],
): ((requestOrigin: string | undefined, callback: CorsCallback) => void) => {
  return (requestOrigin: string | undefined, callback: CorsCallback) => {
    // Handle wildcard origin
    if (origin === "*") {
      callback(null, true);
      return;
    }

    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!requestOrigin) {
      callback(null, true);
      return;
    }

    const allowedOrigins: (string | RegExp)[] = [];
    if (process.env.BASE_URL) {
      allowedOrigins.push(ensureProtocol(process.env.BASE_URL) as string);
    }
    if (process.env.PROJECT_BASE_URL) {
      allowedOrigins.push(
        ensureProtocol(process.env.PROJECT_BASE_URL) as string,
      );
    }
    if (origin) {
      const additionalOrigins = force.array<string>(origin);
      allowedOrigins.push(...additionalOrigins);
    }

    // Add localhost origins in sandbox
    if (
      process.env.PROJECT_ENV === SANDBOX_ENV ||
      envBoolean("PROJECT_SANDBOX_MODE")
    ) {
      allowedOrigins.push("http://localhost");
      allowedOrigins.push(/^http:\/\/localhost:\d+$/);
    }

    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) {
        return allowed.test(requestOrigin);
      }
      return isOriginAllowed(requestOrigin, allowed);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new CorsError());
    }
  };
};

//
//
// Main
//

const corsHelper = (
  config: CorsConfig = {},
): ReturnType<typeof expressCors> => {
  const { origin, overrides = {} } = config;

  const options = {
    origin: dynamicOriginCallbackHandler(origin),
    // * The default behavior is to allow any headers and methods so they are not included here
    ...overrides,
  };

  return expressCors(options);
};

//
//
// Constants
//

const HTTP_CODE_NO_CONTENT = 204;
const HTTP_METHOD_OPTIONS = "OPTIONS";

//
//
// Export
//

interface CorsErrorWithBody extends Error {
  status: number;
  body: () => Record<string, unknown>;
}

/**
 * CORS middleware with Lambda streaming support.
 *
 * For OPTIONS preflight requests, this middleware handles them early and
 * terminates the response immediately. This is critical for Lambda streaming
 * handlers where the response stream would otherwise stay open waiting for
 * streaming data that never comes.
 *
 * For regular requests, delegates to the standard cors package behavior.
 */
export default (
  config?: CorsConfig,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const cors = corsHelper(config);
  const { origin, overrides = {} } = config || {};
  const originHandler = dynamicOriginCallbackHandler(origin);

  return (req: Request, res: Response, next: NextFunction) => {
    // Handle OPTIONS preflight requests early for Lambda streaming compatibility.
    // The standard cors package would eventually call res.end(), but with Lambda
    // streaming, we need to ensure the response is terminated immediately without
    // going through any async middleware chains that might keep the stream open.
    if (req.method === HTTP_METHOD_OPTIONS) {
      const requestOrigin = req.headers.origin;

      originHandler(requestOrigin, (error, isAllowed) => {
        if (error || !isAllowed) {
          // Origin not allowed - send CORS error
          const corsError = error as CorsErrorWithBody;
          if (corsError?.status && corsError?.body) {
            res.status(corsError.status);
            res.setHeader("Content-Type", "application/json");
            res.json(corsError.body());
          } else {
            // Fallback for non-CorsError errors
            res.status(HTTP_CODE_NO_CONTENT);
            if (typeof res.flushHeaders === "function") {
              res.flushHeaders();
            }
            res.end();
          }
          return;
        }

        // Origin is allowed - send preflight response
        // Set CORS headers
        if (requestOrigin) {
          res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        }
        res.setHeader("Vary", "Origin");

        // Allow all methods by default (or use overrides if specified)
        const methods =
          (overrides.methods as string) || "GET,HEAD,PUT,PATCH,POST,DELETE";
        res.setHeader("Access-Control-Allow-Methods", methods);

        // Reflect requested headers (standard cors behavior)
        const requestedHeaders = req.headers["access-control-request-headers"];
        if (requestedHeaders) {
          res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
        }

        // Handle credentials if configured
        if (overrides.credentials === true) {
          res.setHeader("Access-Control-Allow-Credentials", "true");
        }

        // Handle max age if configured
        if (overrides.maxAge !== undefined) {
          res.setHeader("Access-Control-Max-Age", String(overrides.maxAge));
        }

        // Send 204 No Content response and terminate immediately
        // This is critical for Lambda streaming - we must end the response
        // synchronously to prevent the stream from hanging.
        // CRITICAL: Flush headers first to initialize the Lambda stream wrapper.
        // Without this, _wrappedStream may be null when _final() is called,
        // causing the Lambda response stream to never close.
        res.statusCode = HTTP_CODE_NO_CONTENT;
        res.setHeader("Content-Length", "0");
        if (typeof res.flushHeaders === "function") {
          res.flushHeaders();
        }
        res.end();
      });
      return;
    }

    // For non-OPTIONS requests, use the standard cors middleware
    cors(req, res, (error?: Error | null) => {
      if (error) {
        const corsError = error as CorsErrorWithBody;
        res.status(corsError.status);
        res.setHeader("Content-Type", "application/json");
        return res.json(corsError.body());
      }
      next();
    });
  };
};
