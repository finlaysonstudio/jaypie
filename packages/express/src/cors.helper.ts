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
// Export
//

interface CorsErrorWithBody extends Error {
  status: number;
  body: () => Record<string, unknown>;
}

export default (
  config?: CorsConfig,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const cors = corsHelper(config);
  return (req: Request, res: Response, next: NextFunction) => {
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
