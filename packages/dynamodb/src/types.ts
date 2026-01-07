/**
 * DynamoDB client configuration
 */
export interface DynamoClientConfig {
  /** DynamoDB table name */
  tableName: string;
  /** Optional endpoint URL for local development (e.g., "http://127.0.0.1:8100") */
  endpoint?: string;
  /** AWS region (default: "us-east-1") */
  region?: string;
  /** Optional credentials for local development */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Parent reference for calculating OU
 */
export interface ParentReference {
  id: string;
  model: string;
}

/**
 * Query options for GSI queries
 */
export interface QueryOptions {
  /** Whether to sort ascending (oldest first). Default: false (most recent first) */
  ascending?: boolean;
  /** Whether to include soft-deleted records. Default: false */
  includeDeleted?: boolean;
  /** Maximum number of items to return */
  limit?: number;
  /** Pagination cursor from previous query */
  startKey?: Record<string, unknown>;
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

  // GSI Keys (auto-populated by populateIndexKeys)
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
  /** Soft-delete timestamp */
  deletedAt?: string;
}
