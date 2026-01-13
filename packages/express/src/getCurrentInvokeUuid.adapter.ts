import type { Request } from "express";

import { getCurrentInvoke } from "./adapter/index.js";
import getWebAdapterUuid from "./getCurrentInvokeUuid.webadapter.js";

//
//
// Constants
//

const HEADER_AMZN_REQUEST_ID = "x-amzn-request-id";

//
//
// Helper Functions
//

/**
 * Detect if we're running in Lambda Web Adapter mode.
 * Web Adapter sets the x-amzn-request-id header on requests.
 */
function isWebAdapterMode(req?: Request): boolean {
  if (req && req.headers && req.headers[HEADER_AMZN_REQUEST_ID]) {
    return true;
  }
  return false;
}

/**
 * Get UUID from Jaypie Lambda adapter context.
 * This is set by createLambdaHandler/createLambdaStreamHandler.
 */
function getJaypieAdapterUuid(): string | undefined {
  const currentInvoke = getCurrentInvoke();
  if (currentInvoke?.context?.awsRequestId) {
    return currentInvoke.context.awsRequestId;
  }
  return undefined;
}

/**
 * Get UUID from request object if it has Lambda context attached.
 * The Jaypie adapter attaches _lambdaContext to the request.
 */
function getRequestContextUuid(req?: Request): string | undefined {
  if (req && (req as any)._lambdaContext?.awsRequestId) {
    return (req as any)._lambdaContext.awsRequestId;
  }
  return undefined;
}

//
//
// Main
//

/**
 * Get the current invoke UUID from Lambda context.
 * Works with Jaypie Lambda adapter and Lambda Web Adapter mode.
 *
 * @param req - Optional Express request object. Used to extract context
 *              from Web Adapter headers or Jaypie adapter's _lambdaContext.
 * @returns The AWS request ID or undefined if not in Lambda context
 */
function getCurrentInvokeUuid(req?: Request): string | undefined {
  // Priority 1: Web Adapter mode (header-based)
  if (isWebAdapterMode(req)) {
    return getWebAdapterUuid(req);
  }

  // Priority 2: Request has Lambda context attached (Jaypie adapter)
  const requestContextUuid = getRequestContextUuid(req);
  if (requestContextUuid) {
    return requestContextUuid;
  }

  // Priority 3: Global context from Jaypie adapter
  const jaypieAdapterUuid = getJaypieAdapterUuid();
  if (jaypieAdapterUuid) {
    return jaypieAdapterUuid;
  }

  // Fallback: Web Adapter env var
  return getWebAdapterUuid();
}

//
//
// Export
//

export default getCurrentInvokeUuid;
