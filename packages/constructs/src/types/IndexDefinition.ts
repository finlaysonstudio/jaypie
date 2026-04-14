/**
 * GSI index definition for JaypieDynamoDb.
 *
 * Shape mirrors `@jaypie/fabric`'s IndexDefinition so a single object can be
 * shared between CDK provisioning (here) and runtime model code (fabric).
 * The type is owned locally so `@jaypie/constructs` does not take a runtime
 * dependency on the pre-1.0 `@jaypie/fabric` package.
 *
 * - `pk` fields are combined with a separator to form the partition key attribute
 * - `sk` with one field uses that field directly as the GSI sort key
 * - `sk` with multiple fields produces a composite `{indexName}Sk` attribute
 */
export interface IndexDefinition {
  /** Name of the index (auto-generated from pk fields if not provided) */
  name?: string;
  /** Partition key fields - combined with separator */
  pk: string[];
  /** Sort key fields - combined with separator when composite */
  sk?: string[];
  /** Advisory: index key is only written when all pk/sk fields are present */
  sparse?: boolean;
}
