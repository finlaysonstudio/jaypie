import * as original from "@jaypie/dynamodb";
import type {
  BaseQueryOptions,
  DynamoClientConfig,
  ExportResult,
  FabricEntity,
  ParentReference,
  QueryResult,
  SeedOptions,
  SeedResult,
} from "@jaypie/dynamodb";

import { createMockFunction, createMockResolvedFunction } from "./utils";

// Re-export constants (no need to mock, just pass through)
export const APEX = original.APEX;
export const ARCHIVED_SUFFIX = original.ARCHIVED_SUFFIX;
export const DELETED_SUFFIX = original.DELETED_SUFFIX;
export const INDEX_ALIAS = original.INDEX_ALIAS;
export const INDEX_CLASS = original.INDEX_CLASS;
export const INDEX_OU = original.INDEX_OU;
export const INDEX_TYPE = original.INDEX_TYPE;
export const INDEX_XID = original.INDEX_XID;
export const SEPARATOR = original.SEPARATOR;

// Key builder functions - use createMockFunction with typed implementations
export const buildIndexAlias = createMockFunction<
  (ou: string, model: string, alias: string) => string
>((ou, model, alias) => original.buildIndexAlias(ou, model, alias));

export const buildIndexClass = createMockFunction<
  (ou: string, model: string, recordClass: string) => string
>((ou, model, recordClass) => original.buildIndexClass(ou, model, recordClass));

export const buildIndexOu = createMockFunction<
  (ou: string, model: string) => string
>((ou, model) => original.buildIndexOu(ou, model));

export const buildIndexType = createMockFunction<
  (ou: string, model: string, type: string) => string
>((ou, model, type) => original.buildIndexType(ou, model, type));

export const buildIndexXid = createMockFunction<
  (ou: string, model: string, xid: string) => string
>((ou, model, xid) => original.buildIndexXid(ou, model, xid));

export const calculateOu = createMockFunction<
  (parent?: ParentReference) => string
>((parent) => original.calculateOu(parent));

export const indexEntity = createMockFunction<
  <T extends FabricEntity>(entity: T, suffix?: string) => T
>(<T extends FabricEntity>(entity: T, suffix?: string) =>
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
  (params: { id: string; model: string }) => Promise<FabricEntity | null>
>(async () => null);

export const putEntity = createMockFunction<
  (params: { entity: FabricEntity }) => Promise<FabricEntity>
>(async (params: { entity: FabricEntity }) =>
  original.indexEntity(params.entity),
);

export const updateEntity = createMockFunction<
  (params: { entity: FabricEntity }) => Promise<FabricEntity>
>(async (params: { entity: FabricEntity }) => ({
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
export const queryByOu = createMockFunction<
  (params: {
    model: string;
    ou: string;
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    limit?: number;
    startKey?: Record<string, unknown>;
  }) => Promise<QueryResult<FabricEntity>>
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
    ou: string;
  }) => Promise<FabricEntity | null>
>(async () => null);

export const queryByClass = createMockFunction<
  (params: {
    archived?: boolean;
    ascending?: boolean;
    deleted?: boolean;
    limit?: number;
    model: string;
    ou: string;
    recordClass: string;
    startKey?: Record<string, unknown>;
  }) => Promise<QueryResult<FabricEntity>>
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
    ou: string;
    startKey?: Record<string, unknown>;
    type: string;
  }) => Promise<QueryResult<FabricEntity>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByXid = createMockFunction<
  (params: {
    archived?: boolean;
    deleted?: boolean;
    model: string;
    ou: string;
    xid: string;
  }) => Promise<FabricEntity | null>
>(async () => null);

// Seed and export utilities
export const seedEntityIfNotExists = createMockFunction<
  <T extends Partial<FabricEntity>>(entity: T) => Promise<boolean>
>(async () => true);

export const seedEntities = createMockFunction<
  <T extends Partial<FabricEntity>>(
    entities: T[],
    options?: SeedOptions,
  ) => Promise<SeedResult>
>(async () => ({
  created: [],
  errors: [],
  skipped: [],
}));

export const exportEntities = createMockFunction<
  <T extends FabricEntity>(
    model: string,
    ou: string,
    limit?: number,
  ) => Promise<ExportResult<T>>
>(async () => ({
  count: 0,
  entities: [],
}));

export const exportEntitiesToJson = createMockFunction<
  (model: string, ou: string, pretty?: boolean) => Promise<string>
>(async () => "[]");

// Re-export types for convenience
export type {
  BaseQueryOptions,
  ExportResult,
  FabricEntity,
  ParentReference,
  QueryResult,
  SeedOptions,
  SeedResult,
};
