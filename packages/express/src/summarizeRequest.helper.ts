import type { Request } from "express";
import { redactAuth } from "@jaypie/logger";

import { EXPRESS } from "./constants.js";

//
//
// Types
//

export interface RequestSummary {
  baseUrl: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  query: Request["query"];
  url: string;
}

export interface SummarizeRequestOptions {
  /**
   * Include the request body. Set false for a route that receives a
   * third-party payload the log should not carry.
   */
  logBody?: boolean;
  /**
   * Header names redacted in addition to `EXPRESS.HEADER.SENSITIVE`.
   * Matching is case-insensitive.
   */
  sensitiveHeaders?: string[];
}

//
//
// Function Definition
//

function summarizeRequest(
  req: Request,
  { logBody = true, sensitiveHeaders = [] }: SummarizeRequestOptions = {},
): RequestSummary {
  // Redact sensitive headers; the option adds to the defaults
  const redacted = new Set(
    [...EXPRESS.HEADER.SENSITIVE, ...sensitiveHeaders].map((header) =>
      header.toLowerCase(),
    ),
  );
  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
  };
  for (const key of Object.keys(headers)) {
    if (redacted.has(key.toLowerCase())) {
      headers[key] = redactAuth(headers[key]);
    }
  }

  const summary: RequestSummary = {
    baseUrl: req.baseUrl,
    headers,
    method: req.method,
    query: req.query,
    url: req.url,
  };

  if (logBody) {
    // If body is a buffer, convert it to a string
    const { body } = req;
    summary.body = Buffer.isBuffer(body) ? body.toString() : body;
  }

  return summary;
}

//
//
// Export
//

export default summarizeRequest;
