import type { Response } from "express";

//
//
// Types
//

export interface ResponseSummary {
  statusCode: number;
  statusMessage: string;
  headers?: ReturnType<Response["getHeaders"]>;
  [key: string]: unknown;
}

//
//
// Function Definition
//

function summarizeResponse(
  res: Response,
  extras?: Record<string, unknown>,
): ResponseSummary {
  const response: ResponseSummary = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
  };
  if (typeof res.getHeaders === "function") {
    response.headers = res.getHeaders();
  }
  if (typeof extras === "object" && extras !== null) {
    Object.assign(response, extras);
  }
  return response;
}

//
//
// Export
//

export default summarizeResponse;
