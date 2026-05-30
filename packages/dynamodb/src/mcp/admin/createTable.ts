import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { fabricService } from "@jaypie/fabric";

import { createTableParams } from "../../tableSchema.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8000";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE_NAME = "jaypie-local";

/**
 * Create DynamoDB table with Jaypie GSI schema
 */
export const createTableHandler = fabricService({
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

    const tableParams = createTableParams(tableNameStr, billingModeStr);
    await client.send(new CreateTableCommand(tableParams));

    return {
      message: "Table created successfully",
      success: true,
      tableName: tableNameStr,
    };
  },
});
