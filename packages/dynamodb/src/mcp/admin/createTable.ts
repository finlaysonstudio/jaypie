import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { serviceHandler } from "@jaypie/vocabulary";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8000";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE_NAME = "jaypie-local";

/**
 * DynamoDB table schema with Jaypie GSI pattern
 */
function createTableParams(
  tableName: string,
  billingMode: "PAY_PER_REQUEST" | "PROVISIONED",
) {
  const gsiProjection = { ProjectionType: "ALL" as const };

  return {
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" as const },
      { AttributeName: "indexAlias", AttributeType: "S" as const },
      { AttributeName: "indexClass", AttributeType: "S" as const },
      { AttributeName: "indexOu", AttributeType: "S" as const },
      { AttributeName: "indexType", AttributeType: "S" as const },
      { AttributeName: "indexXid", AttributeType: "S" as const },
      { AttributeName: "model", AttributeType: "S" as const },
      { AttributeName: "sequence", AttributeType: "N" as const },
    ],
    BillingMode: billingMode,
    GlobalSecondaryIndexes: [
      {
        IndexName: "indexOu",
        KeySchema: [
          { AttributeName: "indexOu", KeyType: "HASH" as const },
          { AttributeName: "sequence", KeyType: "RANGE" as const },
        ],
        Projection: gsiProjection,
      },
      {
        IndexName: "indexAlias",
        KeySchema: [
          { AttributeName: "indexAlias", KeyType: "HASH" as const },
          { AttributeName: "sequence", KeyType: "RANGE" as const },
        ],
        Projection: gsiProjection,
      },
      {
        IndexName: "indexClass",
        KeySchema: [
          { AttributeName: "indexClass", KeyType: "HASH" as const },
          { AttributeName: "sequence", KeyType: "RANGE" as const },
        ],
        Projection: gsiProjection,
      },
      {
        IndexName: "indexType",
        KeySchema: [
          { AttributeName: "indexType", KeyType: "HASH" as const },
          { AttributeName: "sequence", KeyType: "RANGE" as const },
        ],
        Projection: gsiProjection,
      },
      {
        IndexName: "indexXid",
        KeySchema: [
          { AttributeName: "indexXid", KeyType: "HASH" as const },
          { AttributeName: "sequence", KeyType: "RANGE" as const },
        ],
        Projection: gsiProjection,
      },
    ],
    KeySchema: [
      { AttributeName: "model", KeyType: "HASH" as const },
      { AttributeName: "id", KeyType: "RANGE" as const },
    ],
    TableName: tableName,
  };
}

/**
 * Create DynamoDB table with Jaypie GSI schema
 */
export const createTableHandler = serviceHandler({
  alias: "dynamodb_create_table",
  description: "Create DynamoDB table with Jaypie GSI schema",
  input: {
    billingMode: {
      type: ["PAY_PER_REQUEST", "PROVISIONED"] as const,
      default: "PAY_PER_REQUEST",
      description: "DynamoDB billing mode",
    },
    endpoint: {
      type: String,
      default: DEFAULT_ENDPOINT,
      description: "DynamoDB endpoint URL",
    },
    tableName: {
      type: String,
      default: DEFAULT_TABLE_NAME,
      description: "Table name to create",
    },
  },
  service: async ({ billingMode, endpoint, tableName }) => {
    const endpointStr = endpoint as string;
    const tableNameStr = tableName as string;
    const billingModeStr = billingMode as "PAY_PER_REQUEST" | "PROVISIONED";

    const client = new DynamoDBClient({
      credentials: {
        accessKeyId: "local",
        secretAccessKey: "local",
      },
      endpoint: endpointStr,
      region: DEFAULT_REGION,
    });

    try {
      // Check if table already exists
      await client.send(new DescribeTableCommand({ TableName: tableNameStr }));
      return {
        message: `Table "${tableNameStr}" already exists`,
        success: false,
        tableName: tableNameStr,
      };
    } catch (error) {
      if ((error as { name?: string }).name !== "ResourceNotFoundException") {
        throw error;
      }
    }

    // Create the table
    const tableParams = createTableParams(tableNameStr, billingModeStr);
    await client.send(new CreateTableCommand(tableParams));

    return {
      message: "Table created successfully",
      success: true,
      tableName: tableNameStr,
    };
  },
});
