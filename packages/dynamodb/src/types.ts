import type { FabricModel } from "@jaypie/fabric";

/**
 * DynamoDB client configuration
 */
export interface DynamoClientConfig {
  /** Optional credentials for local development */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Optional endpoint URL for local development (e.g., "http://127.0.0.1:8100") */
  endpoint?: string;
  /** AWS region (falls back to AWS_REGION env var, then "us-east-1") */
  region?: string;
  /** DynamoDB table name (falls back to DYNAMODB_TABLE_NAME env var) */
  tableName?: string;
}

/**
 * Parent reference for calculating scope
 */
export interface ParentReference {
  id: string;
  model: string;
}

/**
 * Base query options shared by all query functions
 */
export interface BaseQueryOptions {
  /** Query archived entities instead of active ones */
  archived?: boolean;
  /** Whether to sort ascending (oldest first). Default: false (most recent first) */
  ascending?: boolean;
  /** Query deleted entities instead of active ones */
  deleted?: boolean;
  /** Maximum number of items to return */
  limit?: number;
  /** Pagination cursor from previous query */
  startKey?: Record<string, unknown>;
}

/**
 * Parameters for queryByScope
 */
export interface QueryByScopeParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The scope (APEX or "{parent.model}#{parent.id}") */
  scope: string;
}

/**
 * Parameters for queryByAlias
 */
export interface QueryByAliasParams {
  /** The human-friendly alias */
  alias: string;
  /** Query archived entities instead of active ones */
  archived?: boolean;
  /** Query deleted entities instead of active ones */
  deleted?: boolean;
  /** The entity model name */
  model: string;
  /** The scope */
  scope: string;
}

/**
 * Parameters for queryByCategory
 */
export interface QueryByCategoryParams extends BaseQueryOptions {
  /** The category classification */
  category: string;
  /** The entity model name */
  model: string;
  /** The scope */
  scope: string;
}

/**
 * Parameters for queryByType
 */
export interface QueryByTypeParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The scope */
  scope: string;
  /** The type classification */
  type: string;
}

/**
 * Parameters for queryByXid
 */
export interface QueryByXidParams {
  /** Query archived entities instead of active ones */
  archived?: boolean;
  /** Query deleted entities instead of active ones */
  deleted?: boolean;
  /** The entity model name */
  model: string;
  /** The scope */
  scope: string;
  /** The external ID */
  xid: string;
}

/**
 * Result of a query operation
 */
export interface QueryResult<T = StorableEntity> {
  /** Array of matching entities */
  items: T[];
  /** Pagination cursor for next page (undefined if no more results) */
  lastEvaluatedKey?: Record<string, unknown>;
}

/**
 * Entity with required fields for DynamoDB storage.
 *
 * Extends FabricModel from @jaypie/fabric with:
 * - Required storage fields (id, model, name, scope, sequence)
 * - String timestamps (DynamoDB uses ISO 8601 strings, not Date objects)
 * - GSI index keys (auto-populated by indexEntity)
 */
export interface StorableEntity extends Omit<
  FabricModel,
  "archivedAt" | "createdAt" | "deletedAt" | "updatedAt"
> {
  // Primary Key
  /** Partition key (e.g., "record", "message") */
  model: string;
  /** Sort key (UUID) */
  id: string;

  // Required fields
  /** Human-readable name */
  name: string;
  /** Scope: APEX ("@") or "{parent.model}#{parent.id}" */
  scope: string;
  /** Timestamp for chronological ordering (Date.now()) */
  sequence: number;

  // GSI Keys (auto-populated by indexEntity)
  indexAlias?: string;
  indexCategory?: string;
  indexScope?: string;
  indexType?: string;
  indexXid?: string;

  // Timestamps (ISO 8601 strings - DynamoDB doesn't store Date objects)
  createdAt: string;
  updatedAt: string;
  /** Archive timestamp (for inactive but preserved records) */
  archivedAt?: string;
  /** Soft-delete timestamp */
  deletedAt?: string;
}
