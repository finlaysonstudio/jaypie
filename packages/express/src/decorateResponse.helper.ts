import type { Response } from "express";
import { HTTP, JAYPIE } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";

import getCurrentInvokeUuid from "./getCurrentInvokeUuid.adapter.js";

//
//
// Types
//

interface DecorateResponseOptions {
  handler?: string;
  version?: string;
}

// Extended response type that may have _headers Map and internal bypass methods (Lambda adapter)
interface ExtendedResponse extends Response {
  _headers?: Map<string, string | string[]>;
  // Internal bypass methods added for dd-trace compatibility
  _internalGetHeader?: (name: string) => string | undefined;
  _internalSetHeader?: (name: string, value: string) => void;
}

//
//
// Helpers
//

/**
 * Safely get a header value from response.
 * Handles both Express Response and Lambda adapter responses.
 * Defensive against dd-trace instrumentation issues.
 */
function safeGetHeader(
  res: ExtendedResponse,
  name: string,
): string | undefined {
  try {
    // Try internal method first (completely bypasses dd-trace)
    if (typeof res._internalGetHeader === "function") {
      return res._internalGetHeader(name);
    }
    // Fall back to _headers Map access (Lambda adapter, avoids dd-trace)
    if (res._headers instanceof Map) {
      const value = res._headers.get(name.toLowerCase());
      return value ? String(value) : undefined;
    }
    // Fall back to getHeader (more standard than get)
    if (typeof res.getHeader === "function") {
      const value = res.getHeader(name);
      return value ? String(value) : undefined;
    }
    // Last resort: try get
    if (typeof res.get === "function") {
      const value = res.get(name);
      return value ? String(value) : undefined;
    }
  } catch {
    // Silently fail - caller will handle missing value
  }
  return undefined;
}

/**
 * Safely set a header value on response.
 * Handles both Express Response and Lambda adapter responses.
 * Defensive against dd-trace instrumentation issues.
 */
function safeSetHeader(
  res: ExtendedResponse,
  name: string,
  value: string,
): void {
  try {
    // Try internal method first (completely bypasses dd-trace)
    if (typeof res._internalSetHeader === "function") {
      res._internalSetHeader(name, value);
      return;
    }
    // Fall back to _headers Map access (Lambda adapter, avoids dd-trace)
    if (res._headers instanceof Map) {
      res._headers.set(name.toLowerCase(), value);
      return;
    }
    // Fall back to setHeader (more standard than set)
    if (typeof res.setHeader === "function") {
      res.setHeader(name, value);
      return;
    }
    // Last resort: try set
    if (typeof res.set === "function") {
      res.set(name, value);
    }
  } catch {
    // Silently fail - header just won't be set
  }
}

//
//
// Main
//

const decorateResponse = (
  res: Response,
  {
    handler = "",
    version = process.env.PROJECT_VERSION,
  }: DecorateResponseOptions = {},
): void => {
  const log = publicLogger.lib({
    lib: JAYPIE.LIB.EXPRESS,
  });

  //
  //
  // Validate
  //
  if (typeof res !== "object" || res === null) {
    log.warn("decorateResponse called but response is not an object");
    return;
  }

  const extRes = res as ExtendedResponse;

  try {
    //
    //
    // Decorate Headers
    //

    // X-Powered-By, override "Express" but nothing else
    const currentPoweredBy = safeGetHeader(extRes, HTTP.HEADER.POWERED_BY);
    if (!currentPoweredBy || currentPoweredBy === "Express") {
      safeSetHeader(extRes, HTTP.HEADER.POWERED_BY, JAYPIE.LIB.EXPRESS);
    }

    // X-Project-Environment
    if (process.env.PROJECT_ENV) {
      safeSetHeader(
        extRes,
        HTTP.HEADER.PROJECT.ENVIRONMENT,
        process.env.PROJECT_ENV,
      );
    }

    // X-Project-Handler
    if (handler) {
      safeSetHeader(extRes, HTTP.HEADER.PROJECT.HANDLER, handler);
    }

    // X-Project-Invocation
    const currentInvoke = getCurrentInvokeUuid();
    if (currentInvoke) {
      safeSetHeader(extRes, HTTP.HEADER.PROJECT.INVOCATION, currentInvoke);
    }

    // X-Project-Key
    if (process.env.PROJECT_KEY) {
      safeSetHeader(extRes, HTTP.HEADER.PROJECT.KEY, process.env.PROJECT_KEY);
    }

    // X-Project-Version
    if (version) {
      safeSetHeader(extRes, HTTP.HEADER.PROJECT.VERSION, version);
    }

    //
    //
    // Error Handling
    //
  } catch (error) {
    log.warn("decorateResponse caught an internal error");
    log.var({ error });
  }
};

//
//
// Export
//

export default decorateResponse;

//
//
// Footnotes
//

// This is a "utility" function but it needs a lot of "context"
// about the environment's secret parameters, the special adapter,
// HTTP, etc.  There must be a better way to organize this
