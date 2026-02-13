import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  fabricService,
  getAllRegisteredIndexes,
  type IndexDefinition,
} from "@jaypie/fabric";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8000";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE_NAME = "jaypie-local";

// =============================================================================
// Index to GSI Conversion
// =============================================================================

/**
 * Generate an index name from pk fields (if not provided)
 */
function generateIndexName(pk: string[]): string {
  const suffix = pk
    .map((field) => field.charAt(0).toUpperCase() + field.slice(1))
    .join("");
  return `index${suffix}`;
}

/**
 * Collect all unique indexes from registered models
 */
function collectAllIndexes(): IndexDefinition[] {
  const indexMap = new Map<string, IndexDefinition>();

  for (const index of getAllRegisteredIndexes()) {
    const name = index.name ?? generateIndexName(index.pk as string[]);
    if (!indexMap.has(name)) {
      indexMap.set(name, { ...index, name });
    }
  }

  return Array.from(indexMap.values());
}

/**
 * Build attribute definitions from indexes
 */
function buildAttributeDefinitions(
  indexes: IndexDefinition[],
): Array<{ AttributeName: string; AttributeType: "S" | "N" }> {
  const attrs = new Map<string, "S" | "N">();

  // Primary key attributes
  attrs.set("model", "S");
  attrs.set("id", "S");
  attrs.set("sequence", "N");

  // GSI attributes (partition keys are always strings)
  for (const index of indexes) {
    const indexName = index.name ?? generateIndexName(index.pk as string[]);
    attrs.set(indexName, "S");
  }

  // Sort keys (sequence is always a number, others would be strings)
  // Note: Currently all indexes use sequence as SK, so this is mostly future-proofing
  for (const index of indexes) {
    const sk = index.sk ?? ["sequence"];
    for (const skField of sk) {
      if (!attrs.has(skField as string)) {
        // Assume string unless it's sequence
        attrs.set(skField as string, skField === "sequence" ? "N" : "S");
      }
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
 * Build GSI definitions from indexes
 */
function buildGSIs(indexes: IndexDefinition[]): Array<{
  IndexName: string;
  KeySchema: Array<{ AttributeName: string; KeyType: "HASH" | "RANGE" }>;
  Projection: { ProjectionType: "ALL" };
}> {
  const gsiProjection = { ProjectionType: "ALL" as const };

  return indexes.map((index) => {
    const indexName = index.name ?? generateIndexName(index.pk as string[]);
    const sk = index.sk ?? ["sequence"];

    // For GSIs, the partition key attribute name IS the index name
    // (e.g., indexOu stores the composite key value "@#record")
    return {
      IndexName: indexName,
      KeySchema: [
        { AttributeName: indexName, KeyType: "HASH" as const },
        // Use first SK field as the range key attribute
        { AttributeName: sk[0] as string, KeyType: "RANGE" as const },
      ],
      Projection: gsiProjection,
    };
  });
}

// =============================================================================
// Table Creation
// =============================================================================

/**
 * DynamoDB table schema with Jaypie GSI pattern
 *
 * Collects indexes from models registered via registerModel()
 */
function createTableParams(
  tableName: string,
  billingMode: "PAY_PER_REQUEST" | "PROVISIONED",
) {
  const allIndexes = collectAllIndexes();

  return {
    AttributeDefinitions: buildAttributeDefinitions(allIndexes),
    BillingMode: billingMode,
    GlobalSecondaryIndexes: buildGSIs(allIndexes),
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
