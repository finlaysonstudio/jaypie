import * as original from "@jaypie/dynamodb";
import type {
  DynamoClientConfig,
  FabricEntity,
  ParentReference,
  QueryOptions,
  QueryResult,
} from "@jaypie/dynamodb";

import { createMockFunction, createMockResolvedFunction } from "./utils";

// Re-export constants (no need to mock, just pass through)
export const APEX = original.APEX;
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

export const populateIndexKeys = createMockFunction<
  <T extends FabricEntity>(entity: T) => T
>(<T extends FabricEntity>(entity: T) => original.populateIndexKeys(entity));

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

// Query functions - return empty results by default
export const queryByOu = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    ou: string,
    model: string,
    options?: QueryOptions,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByAlias = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    ou: string,
    model: string,
    alias: string,
  ) => Promise<T | null>
>(async () => null);

export const queryByClass = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    ou: string,
    model: string,
    recordClass: string,
    options?: QueryOptions,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByType = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    ou: string,
    model: string,
    type: string,
    options?: QueryOptions,
  ) => Promise<QueryResult<T>>
>(async () => ({
  items: [],
  lastEvaluatedKey: undefined,
}));

export const queryByXid = createMockFunction<
  <T extends FabricEntity = FabricEntity>(
    ou: string,
    model: string,
    xid: string,
  ) => Promise<T | null>
>(async () => null);
