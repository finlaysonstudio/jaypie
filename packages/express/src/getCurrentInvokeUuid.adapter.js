import { getCurrentInvoke } from "@codegenie/serverless-express";

//
//
// Helper Functions
//

// Adapter for the "@codegenie/serverless-express" uuid
function getServerlessExpressUuid() {
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

const getCurrentInvokeUuid = () => getServerlessExpressUuid();

//
//
// Export
//

export default getCurrentInvokeUuid;
