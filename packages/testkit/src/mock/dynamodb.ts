import * as original from "@jaypie/dynamodb";
import type {
  BaseQueryOptions,
  DynamoClientConfig,
  ExportResult,
  ParentReference,
  QueryParams,
  QueryResult,
  SeedOptions,
  SeedResult,
  StorableEntity,
} from "@jaypie/dynamodb";
import type { IndexableModel } from "@jaypie/fabric";

import { createMockFunction, createMockResolvedFunction } from "./utils";

// Re-export constants (no need to mock, just pass through)
export const APEX = original.APEX;
export const ARCHIVED_SUFFIX = original.ARCHIVED_SUFFIX;
export const DEFAULT_INDEXES = original.DEFAULT_INDEXES;
export const DELETED_SUFFIX = original.DELETED_SUFFIX;
export const INDEX_ALIAS = original.INDEX_ALIAS;
export const INDEX_CLASS = original.INDEX_CLASS;
export const INDEX_SCOPE = original.INDEX_SCOPE;
export const INDEX_TYPE = original.INDEX_TYPE;
export const INDEX_XID = original.INDEX_XID;
export const SEPARATOR = original.SEPARATOR;

// Key builder functions - use createMockFunction with typed implementations
export const buildCompositeKey = createMockFunction<
  (
    entity: Record<string, unknown> & { model: string },
    fields: string[],
    suffix?: string,
  ) => string
>((entity, fields, suffix) => original.buildCompositeKey(entity, fields, suffix));

export const buildIndexAlias = createMockFunction<
  (scope: string, model: string, alias: string) => string
>((scope, model, alias) => original.buildIndexAlias(scope, model, alias));

export const buildIndexClass = createMockFunction<
  (scope: string, model: string, recordClass: string) => string
>((scope, model, recordClass) => original.buildIndexClass(scope, model, recordClass));

export const buildIndexScope = createMockFunction<
  (scope: string, model: string) => string
>((scope, model) => original.buildIndexScope(scope, model));

export const buildIndexType = createMockFunction<
  (scope: string, model: string, type: string) => string
>((scope, model, type) => original.buildIndexType(scope, model, type));

export const buildIndexXid = createMockFunction<
  (scope: string, model: string, xid: string) => string
>((scope, model, xid) => original.buildIndexXid(scope, model, xid));

export const calculateScope = createMockFunction<
  (parent?: ParentReference) => string
>((parent) => original.calculateScope(parent));

export const indexEntity = createMockFunction<
  <T extends StorableEntity>(entity: T, suffix?: string) => T
>(<T extends StorableEntity>(entity: T, suffix?: string) =>
  original.indexEntity(entity, suffix),
);

// Client functions
export const initClient = createMockFunction<
  (config: DynamoClientConfig) => void
>(() => {
  // No-op in mock
});

export const getDocClient = createMockFunction(() => ({
  send: createMockResolvedFunction({ Items: [] }),
}));

export const getTableName = createMockFunction(() => "mock-table");

export const isInitialized = createMockFunction(() => true);

export const resetClient = createMockFunction(() => {
  // No-op in mock
});

// Entity operations - service handler pattern (callable with object params)
export const getEntity = createMockFunction<
  (params: { id: string; model: string }) => Promise<StorableEntity | null>
>(async () => null);

export const putEntity = createMockFunction<
  (params: { entity: StorableEntity }) => Promise<StorableEntity>
>(async (params: { entity: StorableEntity }) =>
  original.indexEntity(params.entity),
);

export const updateEntity = createMockFunction<
  (params: { entity: StorableEntity }) => Promise<StorableEntity>
>(async (params: { entity: StorableEntity }) => ({
  ...original.indexEntity(params.entity),
  updatedAt: new Date().toISOString(),
}));

export const deleteEntity = createMockFunction<
  (params: { id: string; model: string }) => Promise<boolean>
>(async () => true);

export const archiveEntity = createMockFunction<
  (params: { id: string; model: string }) => Promise<boolean>
>(async () => true);

export const destroyEntity = createMockFunction<
  (params: { id: string; model: string }) => Promise<boolean>
>(async () => true);

// Query functions - service handler pattern (callable with object params)
export const queryByScope = createMockFunction<
  (params: {
    model: string;
    scope: string;
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    limit?: number;
    startKey?: Record<string, unknown>;
  }) => Promise<QueryResult<StorableEntity>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByAlias = createMockFunction<
  (params: {
    alias: string;
    archived?: boolean;
    deleted?: boolean;
    model: string;
    scope: string;
  }) => Promise<StorableEntity | null>
>(async () => null);

export const queryByClass = createMockFunction<
  (params: {
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    limit?: number;
    model: string;
    scope: string;
    recordClass: string;
    startKey?: Record<string, unknown>;
  }) => Promise<QueryResult<StorableEntity>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByType = createMockFunction<
  (params: {
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    limit?: number;
    model: string;
    scope: string;
    startKey?: Record<string, unknown>;
    type: string;
  }) => Promise<QueryResult<StorableEntity>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByXid = createMockFunction<
  (params: {
    archived?: boolean;
    deleted?: boolean;
    model: string;
    scope: string;
    xid: string;
  }) => Promise<StorableEntity | null>
>(async () => null);

// Unified query function with auto-detect
export const query = createMockFunction<
  <T extends StorableEntity = StorableEntity>(params: {
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    filter?: Partial<T>;
    limit?: number;
    model: string;
    scope?: string;
    startKey?: Record<string, unknown>;
  }) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

// Seed and export utilities
export const seedEntityIfNotExists = createMockFunction<
  <T extends Partial<StorableEntity>>(entity: T) => Promise<boolean>
>(async () => true);

export const seedEntities = createMockFunction<
  <T extends Partial<StorableEntity>>(
    entities: T[],
    options?: SeedOptions,
  ) => Promise<SeedResult>
>(async () => ({
  created: [],
  errors: [],
  skipped: [],
}));

export const exportEntities = createMockFunction<
  <T extends StorableEntity>(
    model: string,
    scope: string,
    limit?: number,
  ) => Promise<ExportResult<T>>
>(async () => ({
  count: 0,
  entities: [],
}));

export const exportEntitiesToJson = createMockFunction<
  (model: string, scope: string, pretty?: boolean) => Promise<string>
>(async () => "[]");

// Re-export types for convenience
export type {
  BaseQueryOptions,
  ExportResult,
  ParentReference,
  QueryParams,
  QueryResult,
  SeedOptions,
  SeedResult,
  StorableEntity,
};
export type { IndexableModel };
