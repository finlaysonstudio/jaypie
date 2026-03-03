import type { Request } from "express";

//
//
// Constants
//

const REDACTED = "[REDACTED]";

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);

//
//
// Types
//

export interface RequestSummary {
  baseUrl: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  query: Request["query"];
  url: string;
}

//
//
// Function Definition
//

function summarizeRequest(req: Request): RequestSummary {
  // If body is a buffer, convert it to a string
  let { body } = req;
  if (Buffer.isBuffer(body)) {
    body = body.toString();
  }

  // Redact sensitive headers
  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
  };
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      headers[key] = REDACTED;
    }
  }

  return {
    baseUrl: req.baseUrl,
    body,
    headers,
    method: req.method,
    query: req.query,
    url: req.url,
  };
}

//
//
// Export
//

export default summarizeRequest;
