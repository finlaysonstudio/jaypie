import { ConfigurationError } from "@jaypie/errors";

import { initClient, isInitialized } from "../client.js";

const DEFAULT_REGION = "us-east-1";

/**
 * Ensure DynamoDB client is initialized from environment variables
 * Called automatically before each MCP tool execution
 */
export function ensureInitialized(): void {
  if (isInitialized()) {
    return;
  }

  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    throw new ConfigurationError(
      "DYNAMODB_TABLE_NAME environment variable is required",
    );
  }

  initClient({
    endpoint: process.env.DYNAMODB_ENDPOINT,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    tableName,
  });
}
