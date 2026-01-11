import type { Request } from "express";

//
//
// Types
//

export interface RequestSummary {
  baseUrl: string;
  body: unknown;
  headers: Request["headers"];
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

  return {
    baseUrl: req.baseUrl,
    body,
    headers: req.headers,
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
