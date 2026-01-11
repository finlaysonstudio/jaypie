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
 * Parent reference for calculating OU
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
 * Parameters for queryByOu
 */
export interface QueryByOuParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The organizational unit (APEX or "{parent.model}#{parent.id}") */
  ou: string;
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
  /** The organizational unit */
  ou: string;
}

/**
 * Parameters for queryByClass
 */
export interface QueryByClassParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The organizational unit */
  ou: string;
  /** The category classification */
  recordClass: string;
}

/**
 * Parameters for queryByType
 */
export interface QueryByTypeParams extends BaseQueryOptions {
  /** The entity model name */
  model: string;
  /** The organizational unit */
  ou: string;
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
  /** The organizational unit */
  ou: string;
  /** The external ID */
  xid: string;
}

/**
 * Result of a query operation
 */
export interface QueryResult<T = FabricEntity> {
  /** Array of matching entities */
  items: T[];
  /** Pagination cursor for next page (undefined if no more results) */
  lastEvaluatedKey?: Record<string, unknown>;
}

/**
 * Base entity interface for DynamoDB single-table design
 */
export interface FabricEntity {
  // Primary Key
  /** Partition key (e.g., "record", "message") */
  model: string;
  /** Sort key (UUID) */
  id: string;

  // Required fields
  /** Human-readable name */
  name: string;
  /** Organizational unit: APEX ("@") or "{parent.model}#{parent.id}" */
  ou: string;
  /** Timestamp for chronological ordering (Date.now()) */
  sequence: number;

  // GSI Keys (auto-populated by indexEntity)
  indexAlias?: string;
  indexClass?: string;
  indexOu?: string;
  indexType?: string;
  indexXid?: string;

  // Optional fields (trigger index population when present)
  /** Human-friendly slug/alias */
  alias?: string;
  /** Category classification */
  class?: string;
  /** Type classification */
  type?: string;
  /** External ID for integration with external systems */
  xid?: string;

  // Timestamps (ISO 8601)
  createdAt: string;
  updatedAt: string;
  /** Archive timestamp (for inactive but preserved records) */
  archivedAt?: string;
  /** Soft-delete timestamp */
  deletedAt?: string;
}
