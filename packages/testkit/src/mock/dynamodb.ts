import * as original from "@jaypie/dynamodb";
import type {
  ArchiveEntityParams,
  BaseQueryOptions,
  DeleteEntityParams,
  DynamoClientConfig,
  FabricEntity,
  GetEntityParams,
  ParentReference,
  PutEntityParams,
  QueryByAliasParams,
  QueryByClassParams,
  QueryByOuParams,
  QueryByTypeParams,
  QueryByXidParams,
  QueryResult,
  UpdateEntityParams,
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

// Entity operations - return mock data
export const getEntity = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: GetEntityParams,
  ) => Promise<T | null>
>(async () => null);

export const putEntity = createMockFunction<
  <T extends FabricEntity>(params: PutEntityParams<T>) => Promise<T>
>(async <T extends FabricEntity>(params: PutEntityParams<T>) =>
  original.indexEntity(params.entity),
);

export const updateEntity = createMockFunction<
  <T extends FabricEntity>(params: UpdateEntityParams<T>) => Promise<T>
>(async <T extends FabricEntity>(params: UpdateEntityParams<T>) => ({
  ...original.indexEntity(params.entity),
  updatedAt: new Date().toISOString(),
}));

export const deleteEntity = createMockFunction<
  (params: DeleteEntityParams) => Promise<boolean>
>(async () => true);

export const archiveEntity = createMockFunction<
  (params: ArchiveEntityParams) => Promise<boolean>
>(async () => true);

export const destroyEntity = createMockFunction<
  (params: DeleteEntityParams) => Promise<boolean>
>(async () => true);

// Query functions - return empty results by default (use object params)
export const queryByOu = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: QueryByOuParams,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByAlias = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: QueryByAliasParams,
  ) => Promise<T | null>
>(async () => null);

export const queryByClass = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: QueryByClassParams,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByType = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: QueryByTypeParams,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByXid = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    params: QueryByXidParams,
  ) => Promise<T | null>
>(async () => null);

// Re-export types for convenience
export type { BaseQueryOptions, FabricEntity, ParentReference, QueryResult };
