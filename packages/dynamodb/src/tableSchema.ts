import {
  getAllRegisteredIndexes,
  getGsiAttributeNames,
  type IndexDefinition,
} from "@jaypie/fabric";

export type BillingMode = "PAY_PER_REQUEST" | "PROVISIONED";

/**
 * Build attribute definitions from registered indexes.
 * Primary key is `id` (STRING) only; GSI pk and composite sk attributes
 * are all STRING. A single-field sk (e.g., raw `updatedAt`) is also STRING.
 */
export function buildAttributeDefinitions(
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
export function buildGSIs(indexes: IndexDefinition[]): Array<{
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

/**
 * Build DynamoDB CreateTable params for the Jaypie GSI pattern.
 * Primary key is `id` only. GSIs come from models registered via
 * `registerModel()`, shaped by `fabricIndex()`.
 */
export function createTableParams(tableName: string, billingMode: BillingMode) {
  const allIndexes = getAllRegisteredIndexes();

  return {
    AttributeDefinitions: buildAttributeDefinitions(allIndexes),
    BillingMode: billingMode,
    GlobalSecondaryIndexes: buildGSIs(allIndexes),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" as const }],
    TableName: tableName,
  };
}
