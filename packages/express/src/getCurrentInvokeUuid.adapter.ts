import type { Request } from "express";
import { getCurrentInvoke } from "@codegenie/serverless-express";

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
 * Adapter for the "@codegenie/serverless-express" uuid
 */
function getServerlessExpressUuid(): string | undefined {
  const currentInvoke = getCurrentInvoke();
  if (
    currentInvoke &&
    currentInvoke.context &&
    currentInvoke.context.awsRequestId
  ) {
    return currentInvoke.context.awsRequestId;
  }
  return undefined;
}

//
//
// Main
//

/**
 * Get the current invoke UUID from Lambda context.
 * Works in both serverless-express mode and Lambda Web Adapter mode.
 *
 * @param req - Optional Express request object. Required for Web Adapter mode
 *              to extract the x-amzn-request-id header.
 * @returns The AWS request ID or undefined if not in Lambda context
 */
function getCurrentInvokeUuid(req?: Request): string | undefined {
  // If request is provided and has Web Adapter header, use Web Adapter mode
  if (isWebAdapterMode(req)) {
    return getWebAdapterUuid(req);
  }

  // Try serverless-express mode first
  const serverlessExpressUuid = getServerlessExpressUuid();
  if (serverlessExpressUuid) {
    return serverlessExpressUuid;
  }

  // If no request but we might be in Web Adapter mode, try env var fallback
  return getWebAdapterUuid();
}

//
//
// Export
//

export default getCurrentInvokeUuid;
