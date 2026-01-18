import type { Request } from "express";

import { getCurrentInvoke } from "./adapter/index.js";

//
//
// Helper Functions
//

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
  if (req && (req as unknown as Record<string, unknown>)._lambdaContext) {
    const lambdaContext = (req as unknown as Record<string, unknown>)
      ._lambdaContext as {
      awsRequestId?: string;
    };
    if (lambdaContext.awsRequestId) {
      return lambdaContext.awsRequestId;
    }
  }
  return undefined;
}

//
//
// Main
//

/**
 * Get the current invoke UUID from Lambda context.
 * Works with Jaypie Lambda adapter (createLambdaHandler/createLambdaStreamHandler).
 *
 * @param req - Optional Express request object. Used to extract context
 *              from Jaypie adapter's _lambdaContext.
 * @returns The AWS request ID or undefined if not in Lambda context
 */
function getCurrentInvokeUuid(req?: Request): string | undefined {
  // Priority 1: Request has Lambda context attached (Jaypie adapter)
  const requestContextUuid = getRequestContextUuid(req);
  if (requestContextUuid) {
    return requestContextUuid;
  }

  // Priority 2: Global context from Jaypie adapter
  return getJaypieAdapterUuid();
}

//
//
// Export
//

export default getCurrentInvokeUuid;
