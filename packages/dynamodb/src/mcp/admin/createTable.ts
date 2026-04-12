import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  fabricService,
  getAllRegisteredIndexes,
  getGsiAttributeNames,
  type IndexDefinition,
} from "@jaypie/fabric";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8000";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE_NAME = "jaypie-local";

// =============================================================================
// Index → GSI Conversion
// =============================================================================

/**
 * Build attribute definitions from registered indexes.
 * Primary key is `id` (STRING) only; GSI pk and composite sk attributes
 * are all STRING. A single-field sk (e.g., raw `updatedAt`) is also STRING.
 */
function buildAttributeDefinitions(
  indexes: IndexDefinition[],
): Array<{ AttributeName: string; AttributeType: "S" | "N" }> {
  const attrs = new Map<string, "S" | "N">();

  // Primary key: id only
  attrs.set("id", "S");

  for (const index of indexes) {
    const { pk, sk } = getGsiAttributeNames(index);
    // All pk attributes are composite strings
    if (!attrs.has(pk)) attrs.set(pk, "S");
    if (sk && !attrs.has(sk)) {
      // Single-field `sequence` remains NUMBER for back-compat callers;
      // every other sk attribute (composite or not) is STRING.
      attrs.set(sk, sk === "sequence" ? "N" : "S");
    }
  }

  return Array.from(attrs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, type]) => ({
      AttributeName: name,
      AttributeType: type,
    }));
}

/**
 * Build GSI definitions from registered indexes
 */
function buildGSIs(indexes: IndexDefinition[]): Array<{
  IndexName: string;
  KeySchema: Array<{ AttributeName: string; KeyType: "HASH" | "RANGE" }>;
  Projection: { ProjectionType: "ALL" };
}> {
  const gsiProjection = { ProjectionType: "ALL" as const };

  return indexes.map((index) => {
    const { pk, sk } = getGsiAttributeNames(index);
    const keySchema: Array<{
      AttributeName: string;
      KeyType: "HASH" | "RANGE";
    }> = [{ AttributeName: pk, KeyType: "HASH" }];
    if (sk) {
      keySchema.push({ AttributeName: sk, KeyType: "RANGE" });
    }
    return {
      IndexName: pk,
      KeySchema: keySchema,
      Projection: gsiProjection,
    };
  });
}

// =============================================================================
// Table Creation
// =============================================================================

/**
 * DynamoDB table schema with Jaypie GSI pattern.
 * Primary key is `id` only. GSIs come from models registered via
 * `registerModel()`, shaped by `fabricIndex()`.
 */
function createTableParams(
  tableName: string,
  billingMode: "PAY_PER_REQUEST" | "PROVISIONED",
) {
  const allIndexes = getAllRegisteredIndexes();

  return {
    AttributeDefinitions: buildAttributeDefinitions(allIndexes),
    BillingMode: billingMode,
    GlobalSecondaryIndexes: buildGSIs(allIndexes),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" as const }],
    TableName: tableName,
  };
}

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
