import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ConfigurationError } from "@jaypie/errors";

import type { DynamoClientConfig } from "./types.js";

// Environment variable names
const ENV_AWS_REGION = "AWS_REGION";
const ENV_DYNAMODB_TABLE_NAME = "DYNAMODB_TABLE_NAME";

// Defaults
const DEFAULT_REGION = "us-east-1";
const LOCAL_CREDENTIALS = {
  accessKeyId: "local",
  secretAccessKey: "local",
};

// Module-level state
let docClient: DynamoDBDocumentClient | null = null;
let tableName: string | null = null;

/**
 * Check if endpoint indicates local development mode
 */
function isLocalEndpoint(endpoint?: string): boolean {
  if (!endpoint) return false;
  return endpoint.includes("127.0.0.1") || endpoint.includes("localhost");
}

/**
 * Initialize the DynamoDB client
 * Must be called once at application startup before using query functions
 *
 * @param config - Client configuration
 */
export function initClient(config: DynamoClientConfig = {}): void {
  const { endpoint } = config;
  const region =
    config.region ?? process.env[ENV_AWS_REGION] ?? DEFAULT_REGION;

  // Auto-detect local mode and use dummy credentials
  const credentials =
    config.credentials ??
    (isLocalEndpoint(endpoint) ? LOCAL_CREDENTIALS : undefined);

  const dynamoClient = new DynamoDBClient({
    ...(credentials && { credentials }),
    ...(endpoint && { endpoint }),
    region,
  });

  docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  tableName = config.tableName ?? process.env[ENV_DYNAMODB_TABLE_NAME] ?? null;
}

/**
 * Get the initialized DynamoDB Document Client
 * @throws ConfigurationError if client has not been initialized
 */
export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    throw new ConfigurationError(
      "DynamoDB client not initialized. Call initClient() first.",
    );
  }
  return docClient;
}

/**
 * Get the configured table name
 * @throws ConfigurationError if client has not been initialized
 */
export function getTableName(): string {
  if (!tableName) {
    throw new ConfigurationError(
      "DynamoDB client not initialized. Call initClient() first.",
    );
  }
  return tableName;
}

/**
 * Check if the client has been initialized
 */
export function isInitialized(): boolean {
  return docClient !== null && tableName !== null;
}

/**
 * Reset the client state (primarily for testing)
 */
export function resetClient(): void {
  docClient = null;
  tableName = null;
}
