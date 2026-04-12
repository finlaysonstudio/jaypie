/**
 * Index Types for @jaypie/fabric
 *
 * Declarative index definitions for DynamoDB single-table design.
 * Models register their own indexes via `registerModel`; DynamoDB creates
 * GSIs and selects an index for queries.
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
 * pk fields are combined with SEPARATOR to form the partition key attribute.
 * sk fields are combined with SEPARATOR to form the sort key attribute when
 * `sk.length > 1`. When `sk.length === 1`, the single field is used directly
 * as the GSI sort key.
 */
export interface IndexDefinition {
  /** Name of the index (auto-generated from pk fields if not provided) */
  name?: string;
  /** Partition key fields - combined with SEPARATOR */
  pk: IndexField[];
  /** Sort key fields - combined with SEPARATOR when composite */
  sk?: IndexField[];
  /** Advisory: index key is only written when all pk/sk fields are present */
  sparse?: boolean;
}

/**
 * Model schema with index definitions
 */
export interface ModelSchema {
  /** The model name (e.g., "record", "message", "chat") */
  model: string;
  /** Index definitions for this model */
  indexes?: IndexDefinition[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Suffix appended to index keys when model is archived
 */
export const ARCHIVED_SUFFIX = "#archived";

/**
 * Suffix appended to index keys when model is deleted
 */
export const DELETED_SUFFIX = "#deleted";
