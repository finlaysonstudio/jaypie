/**
 * Index Types for @jaypie/fabric
 *
 * Declarative index definitions for DynamoDB single-table design.
 * Models can specify their own indexes, and dynamodb will create
 * GSIs and auto-detect which index to use for queries.
 */

import type { FabricModel } from "../models/base.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Index field - can be a FabricModel field name or custom field
 */
export type IndexField = keyof FabricModel | string;

/**
 * Single index definition
 *
 * pk fields are combined with SEPARATOR to form the partition key.
 * sk fields are combined with SEPARATOR to form the sort key.
 */
export interface IndexDefinition {
  /** Name of the index (auto-generated from pk fields if not provided) */
  name?: string;
  /** Partition key fields - combined with SEPARATOR */
  pk: IndexField[];
  /** Sort key fields - combined with SEPARATOR (default: ["sequence"]) */
  sk?: IndexField[];
  /** Only create index key when ALL pk fields are present on model */
  sparse?: boolean;
}

/**
 * Model schema with index definitions
 */
export interface ModelSchema {
  /** The model name (e.g., "record", "message", "chat") */
  model: string;
  /** Custom indexes for this model (uses DEFAULT_INDEXES if not specified) */
  indexes?: IndexDefinition[];
}

// =============================================================================
// Default Indexes
// =============================================================================

/**
 * Default indexes for the DynamoDB GSI pattern.
 * These are used when a model does not specify custom indexes.
 */
export const DEFAULT_INDEXES: IndexDefinition[] = [
  { name: "indexOu", pk: ["ou", "model"], sk: ["sequence"] },
  { name: "indexAlias", pk: ["ou", "model", "alias"], sk: ["sequence"], sparse: true },
  { name: "indexClass", pk: ["ou", "model", "class"], sk: ["sequence"], sparse: true },
  { name: "indexType", pk: ["ou", "model", "type"], sk: ["sequence"], sparse: true },
  { name: "indexXid", pk: ["ou", "model", "xid"], sk: ["sequence"], sparse: true },
];

// =============================================================================
// Constants
// =============================================================================

/**
 * Default sort key fields when sk is not specified
 */
export const DEFAULT_SORT_KEY: IndexField[] = ["sequence"];

/**
 * Suffix appended to index keys when model is archived
 */
export const ARCHIVED_SUFFIX = "#archived";

/**
 * Suffix appended to index keys when model is deleted
 */
export const DELETED_SUFFIX = "#deleted";
