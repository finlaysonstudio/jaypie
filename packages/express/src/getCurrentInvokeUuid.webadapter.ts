import type { Request } from "express";

//
//
// Constants
//

const HEADER_AMZN_REQUEST_ID = "x-amzn-request-id";
const ENV_AMZN_TRACE_ID = "_X_AMZN_TRACE_ID";

//
//
// Helper Functions
//

/**
 * Extract request ID from X-Ray trace ID environment variable
 * Format: Root=1-5e6b4a90-example;Parent=example;Sampled=1
 * We extract the trace ID from the Root segment
 */
function parseTraceId(traceId: string): string | undefined {
  if (!traceId) return undefined;

  // Extract the Root segment (format: Root=1-{timestamp}-{uuid})
  const rootMatch = traceId.match(/Root=([^;]+)/);
  if (rootMatch && rootMatch[1]) {
    return rootMatch[1];
  }

  return undefined;
}

//
//
// Main
//

/**
 * Get the current invoke UUID from Lambda Web Adapter context.
 * This function extracts the request ID from either:
 * 1. The x-amzn-request-id header (set by Lambda Web Adapter)
 * 2. The _X_AMZN_TRACE_ID environment variable (set by Lambda runtime)
 *
 * @param req - Optional Express request object to extract headers from
 * @returns The AWS request ID or undefined if not in Lambda context
 */
function getWebAdapterUuid(req?: Request): string | undefined {
  // First, try to get from request headers
  if (req && req.headers) {
    const headerValue = req.headers[HEADER_AMZN_REQUEST_ID];
    if (headerValue) {
      return Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }
  }

  // Fall back to environment variable (X-Ray trace ID)
  const traceId = process.env[ENV_AMZN_TRACE_ID];
  if (traceId) {
    return parseTraceId(traceId);
  }

  return undefined;
}

//
//
// Export
//

export default getWebAdapterUuid;
