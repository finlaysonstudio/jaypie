import { ScanCommand } from "@aws-sdk/lib-dynamodb";

import { getDocClient, getTableName } from "./client.js";

/**
 * Options for table scans
 */
export interface ScanTableOptions {
  /** Items requested per page (DynamoDB Scan Limit); defaults to AWS max */
  pageSize?: number;
  /** Table to scan; defaults to the initialized table name */
  tableName?: string;
}

/**
 * Scan every item in a table, schema-agnostic.
 *
 * Yields raw items one at a time, paginating internally via
 * `LastEvaluatedKey` so large tables stay memory-safe. Unlike the query
 * functions, this issues a full table `Scan` and does not depend on the
 * GSI shape -- making it the source-side reader for table rebuilds, where
 * the old table's indexes no longer match the registered models.
 *
 * @param options - Scan options; `tableName` defaults to the initialized table
 */
export async function* scanTable(
  options: ScanTableOptions = {},
): AsyncGenerator<Record<string, unknown>> {
  const { pageSize } = options;
  const docClient = getDocClient();
  const tableName = options.tableName ?? getTableName();

  let startKey: Record<string, unknown> | undefined;

  do {
    const { Items, LastEvaluatedKey } = await docClient.send(
      new ScanCommand({
        ...(pageSize !== undefined && { Limit: pageSize }),
        ...(startKey && { ExclusiveStartKey: startKey }),
        TableName: tableName,
      }),
    );

    for (const item of Items ?? []) {
      yield item as Record<string, unknown>;
    }

    startKey = LastEvaluatedKey;
  } while (startKey);
}

/**
 * Count every item in a table via a paginated `COUNT` scan.
 *
 * Useful for validating a migration -- compare the source and destination
 * counts before destroying the old table.
 *
 * @param options - Scan options; `tableName` defaults to the initialized table
 * @returns Total item count
 */
export async function countTable(
  options: ScanTableOptions = {},
): Promise<number> {
  const docClient = getDocClient();
  const tableName = options.tableName ?? getTableName();

  let count = 0;
  let startKey: Record<string, unknown> | undefined;

  do {
    const { Count, LastEvaluatedKey } = await docClient.send(
      new ScanCommand({
        Select: "COUNT",
        ...(startKey && { ExclusiveStartKey: startKey }),
        TableName: tableName,
      }),
    );

    count += Count ?? 0;
    startKey = LastEvaluatedKey;
  } while (startKey);

  return count;
}
