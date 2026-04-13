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
export const DELETED_SUFFIX = original.DELETED_SUFFIX;
export const SEPARATOR = original.SEPARATOR;

// Key builder functions — delegate to real implementations
export const buildCompositeKey = createMockFunction<
  (
    entity: Record<string, unknown> & { model: string },
    fields: string[],
    suffix?: string,
  ) => string
>((entity, fields, suffix) =>
  original.buildCompositeKey(entity, fields, suffix),
);

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

// Entity operations — primary key is `id` only
export const getEntity = createMockFunction<
  (params: { id: string }) => Promise<StorableEntity | null>
>(async () => null);

export const createEntity = createMockFunction<
  (params: { entity: StorableEntity }) => Promise<StorableEntity | null>
>(async (params: { entity: StorableEntity }) =>
  original.indexEntity(params.entity),
);

export const updateEntity = createMockFunction<
  (params: { entity: StorableEntity }) => Promise<StorableEntity>
>(async (params: { entity: StorableEntity }) =>
  original.indexEntity(params.entity),
);

export const deleteEntity = createMockFunction<
  (params: { id: string }) => Promise<boolean>
>(async () => true);

export const archiveEntity = createMockFunction<
  (params: { id: string }) => Promise<boolean>
>(async () => true);

export const destroyEntity = createMockFunction<
  (params: { id: string }) => Promise<boolean>
>(async () => true);

export const transactWriteEntities = createMockFunction<
  (params: { entities: StorableEntity[] }) => Promise<void>
>(async () => {
  // No-op in mock
});

// Query functions — scope is optional on every query
export const queryByScope = createMockFunction<
  (params: {
    model: string;
    scope?: string;
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
    scope?: string;
  }) => Promise<StorableEntity | null>
>(async () => null);

export const queryByCategory = createMockFunction<
  (params: {
    archived?: boolean;
    ascending?: boolean;
    category: string;
    deleted?: boolean;
    limit?: number;
    model: string;
    scope?: string;
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
    scope?: string;
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
    scope?: string;
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
