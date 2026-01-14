import { createService } from "@jaypie/fabric";

import { getTableName, isInitialized } from "../../client.js";
import { ensureInitialized } from "../autoInit.js";

/**
 * Check DynamoDB connection status and configuration
 */
export const statusHandler = createService({
  alias: "dynamodb_status",
  description: "Check DynamoDB connection status and configuration",
  service: async () => {
    ensureInitialized();
    return {
      endpoint: process.env.DYNAMODB_ENDPOINT || "AWS Default",
      initialized: isInitialized(),
      region: process.env.AWS_REGION || "us-east-1",
      tableName: getTableName(),
    };
  },
});
