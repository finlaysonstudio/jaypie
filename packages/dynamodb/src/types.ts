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
  /**
   * Optional scope narrower. Passing a scope restricts the query via
   * `begins_with` on the GSI sort key (scope + updatedAt). Omitting it
   * lists every entity of the model across scopes.
   */
  scope?: string;
  /** Pagination cursor from previous query */
  startKey?: Record<string, unknown>;
}

/**
 * Parameters for queryByScope
 */
export interface QueryByScopeParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
}

/**
 * Parameters for queryByAlias
 */
export interface QueryByAliasParams extends BaseQueryOptions {
  /** The human-friendly alias */
  alias: string;
  /** The entity model name */
  model: string;
}

/**
 * Parameters for queryByCategory
 */
export interface QueryByCategoryParams extends BaseQueryOptions {
  /** The category classification */
  category: string;
  /** The entity model name */
  model: string;
}

/**
 * Parameters for queryByType
 */
export interface QueryByTypeParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The type classification */
  type: string;
}

/**
 * Parameters for queryByXid
 */
export interface QueryByXidParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
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
 * Entity stored in DynamoDB.
 *
 * Primary key is `id` only (no sort key). `model` and `scope` are regular
 * attributes; GSI attribute values (e.g., `indexModel`, `indexModelAlias`,
 * `indexModelSk`) are auto-populated by `indexEntity` on every write.
 *
 * `createdAt` and `updatedAt` are both ISO 8601 strings. `updatedAt` is
 * managed by `indexEntity` on every write; callers never set it manually.
 */
export interface StorableEntity extends Omit<
  FabricModel,
  "archivedAt" | "createdAt" | "deletedAt" | "updatedAt"
> {
  /** Primary key (UUID) */
  id: string;
  /** Entity model name (e.g., "record", "message") */
  model: string;
  /** Human-readable name */
  name?: string;
  /** Scope: APEX ("@") or "{parent.model}#{parent.id}" */
  scope: string;

  /** Creation timestamp (ISO 8601). Backfilled by indexEntity if missing. */
  createdAt?: string;
  /** Last-write timestamp (ISO 8601). Managed by indexEntity on every write. */
  updatedAt?: string;
  /** Archive timestamp — presence drives #archived suffix on GSI pk */
  archivedAt?: string;
  /** Soft-delete timestamp — presence drives #deleted suffix on GSI pk */
  deletedAt?: string;

  // Extensible — DynamoDB entities may carry additional fields
  /** Application-specific state flags */
  state?: Record<string, unknown>;
  /** Allow additional properties (including dynamically named GSI attrs) */
  [key: string]: unknown;
}
