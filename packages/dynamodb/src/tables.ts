import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

import { getClient, getTableName } from "./client.js";
import { type BillingMode, createTableParams } from "./tableSchema.js";

const DEFAULT_WAIT_SECONDS = 120;

/**
 * Options for `createTable`
 */
export interface CreateTableOptions {
  /** DynamoDB billing mode (default: PAY_PER_REQUEST) */
  billingMode?: BillingMode;
  /** Table name to create; defaults to the initialized table name */
  tableName?: string;
  /** Wait until the table is ACTIVE before resolving (default: true) */
  wait?: boolean;
}

/**
 * Result of `createTable`
 */
export interface CreateTableResult {
  /** Whether a table was created (false if it already existed) */
  created: boolean;
  /** Human-readable outcome */
  message: string;
  /** The table name */
  tableName: string;
}

/**
 * Create a DynamoDB table with the Jaypie GSI schema.
 *
 * GSIs are derived from models registered via `registerModel()`. Uses the
 * initialized client (`initClient`), so it targets real AWS or local
 * depending on that config. Waits until the table is ACTIVE by default --
 * required before writing during a migration.
 *
 * @param options - Create options; `tableName` defaults to the initialized table
 */
export async function createTable(
  options: CreateTableOptions = {},
): Promise<CreateTableResult> {
  const { billingMode = "PAY_PER_REQUEST", wait = true } = options;
  const client = getClient();
  const tableName = options.tableName ?? getTableName();

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return {
      created: false,
      message: `Table "${tableName}" already exists`,
      tableName,
    };
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceNotFoundException") {
      throw error;
    }
  }

  await client.send(
    new CreateTableCommand(createTableParams(tableName, billingMode)),
  );

  if (wait) {
    await waitUntilTableExists(
      { client, maxWaitTime: DEFAULT_WAIT_SECONDS },
      { TableName: tableName },
    );
  }

  return {
    created: true,
    message: `Table "${tableName}" created`,
    tableName,
  };
}

/**
 * Delete a DynamoDB table.
 *
 * `tableName` is required with no default -- deleting a table is destructive
 * and must be intentional. Uses the initialized client (`initClient`).
 *
 * @param params - Must specify the table name to delete
 */
export async function destroyTable({
  tableName,
}: {
  tableName: string;
}): Promise<{ destroyed: boolean; tableName: string }> {
  const client = getClient();
  await client.send(new DeleteTableCommand({ TableName: tableName }));
  return { destroyed: true, tableName };
}
