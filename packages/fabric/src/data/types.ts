import type { FabricModel } from "../models/base.js";
import type {
  AuthorizationConfig,
  CorsOption,
  FabricHttpService,
  HttpContext,
} from "../http/types.js";
import type { InputFieldDefinition } from "../types.js";

// #region Constants

/**
 * Default pagination limit for list operations
 */
export const DEFAULT_LIMIT = 20;

/**
 * Maximum pagination limit
 */
export const MAX_LIMIT = 100;

// #endregion

// #region Scope

/**
 * Context passed to scope calculation function
 */
export interface ScopeContext {
  /** Parsed request body */
  body: unknown;
  /** Path parameters extracted from route pattern */
  params: Record<string, string>;
  /** Query string parameters */
  query: URLSearchParams;
}

/**
 * Function that calculates scope for queries and new entities
 * Returns APEX ("@") for root-level entities or "{parent.model}#{parent.id}" for children
 */
export type ScopeFunction = (context: ScopeContext) => string | Promise<string>;

// #endregion

// #region Operation Configuration

/**
 * Per-operation configuration for FabricData
 */
export interface FabricDataOperationConfig<
  T extends FabricModel = FabricModel,
> {
  /** Override authorization for this operation */
  authorization?: AuthorizationConfig;
  /** Enable/disable this operation (default: true) */
  enabled?: boolean;
  /** Custom HTTP transform for this operation */
  http?: (
    context: HttpContext,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Transform input before saving (create/update only) */
  transform?: (
    input: Record<string, unknown>,
    existing?: T | null,
  ) => Partial<T>;
}

/**
 * Simplified operation config - boolean to enable/disable or full config
 */
export type FabricDataOperationOption<T extends FabricModel = FabricModel> =
  | FabricDataOperationConfig<T>
  | boolean;

// #endregion

// #region Execute Actions

/**
 * Custom execute action configuration
 */
export interface FabricDataExecuteConfig<T extends FabricModel = FabricModel> {
  /** Route alias (creates route: /{model}/:id/{alias}) */
  alias: string;
  /** Human-readable description */
  description?: string;
  /** Override authorization for this action */
  authorization?: AuthorizationConfig;
  /** Input field definitions for the action */
  input?: Record<string, InputFieldDefinition>;
  /** The action implementation - receives entity and input, returns result */
  service: (
    entity: T,
    input: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
}

// #endregion

// #region Model Configuration

/**
 * Model configuration when passing an object instead of string
 */
export interface FabricModelConfig {
  /** Model alias (e.g., "record") */
  alias: string;
  /** Human-readable name (e.g., "Record") */
  name?: string;
  /** Description of the model */
  description?: string;
}

// #endregion

// #region FabricData Configuration

/**
 * Operations configuration map
 */
export interface FabricDataOperations<T extends FabricModel = FabricModel> {
  /** Archive operation: POST /{model}/:id/archive */
  archive?: FabricDataOperationOption<T>;
  /** Create operation: POST /{model} */
  create?: FabricDataOperationOption<T>;
  /** Delete operation: DELETE /{model}/:id */
  delete?: FabricDataOperationOption<T>;
  /** List operation: GET /{model} */
  list?: FabricDataOperationOption<T>;
  /** Read operation: GET /{model}/:id */
  read?: FabricDataOperationOption<T>;
  /** Update operation: POST /{model}/:id */
  update?: FabricDataOperationOption<T>;
}

/**
 * Main FabricData configuration
 */
export interface FabricDataConfig<T extends FabricModel = FabricModel> {
  /** Model alias string or configuration object */
  model: string | FabricModelConfig;
  /** Human-readable label (defaults to model.name or capitalized alias) */
  label?: string;
  /** Base authorization for all operations */
  authorization?: AuthorizationConfig;
  /** CORS configuration for all operations */
  cors?: CorsOption;
  /** Scope calculator - function or static string (default: APEX) */
  scope?: ScopeFunction | string;
  /** Per-operation configuration */
  operations?: FabricDataOperations<T>;
  /** Custom execute actions */
  execute?: FabricDataExecuteConfig<T>[];
  /** Default pagination limit (default: 20) */
  defaultLimit?: number;
  /** Maximum pagination limit (default: 100) */
  maxLimit?: number;
}

// #endregion

// #region FabricData Result

/**
 * Result returned by FabricData
 */
export interface FabricDataResult {
  /** Array of HTTP services for use with FabricHttpServer */
  services: FabricHttpService[];
  /** Model alias */
  model: string;
  /** Route prefix (/{model} pluralized) */
  prefix: string;
}

// #endregion

// #region Service Context

/**
 * Context passed to FabricData service functions
 */
export interface FabricDataContext {
  /** Calculated scope for queries */
  scope: string;
  /** Model alias */
  model: string;
  /** Pagination limit */
  limit: number;
  /** Maximum limit */
  maxLimit: number;
  /** Authorization result (if authorization is configured) */
  auth?: unknown;
}

// #endregion

// #region List Query Options

/**
 * Options for list operations
 */
export interface FabricDataListOptions {
  /** Pagination limit */
  limit?: number;
  /** Pagination cursor */
  startKey?: string;
  /** Sort order (default: descending by sequence) */
  ascending?: boolean;
  /** Include archived entities */
  archived?: boolean;
  /** Include deleted entities */
  deleted?: boolean;
}

/**
 * List response format
 * Note: items type is generic to support both FabricModel (Date fields) and
 * StorableEntity (string fields) from DynamoDB
 */
export interface FabricDataListResponse<T = unknown> {
  /** Array of items */
  items: T[];
  /** Pagination cursor for next page (if more results exist) */
  nextKey?: string;
  /** Total count (optional, may not always be available) */
  count?: number;
}

// #endregion

// #region Internal Types

/**
 * Resolved model configuration (after normalizing string/object input)
 */
export interface ResolvedModelConfig {
  /** Model alias */
  alias: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description?: string;
  /** Pluralized alias for routes */
  pluralAlias: string;
}

/**
 * Resolved operation configuration
 */
export interface ResolvedOperationConfig<T extends FabricModel = FabricModel> {
  /** Whether operation is enabled */
  enabled: boolean;
  /** Authorization configuration */
  authorization?: AuthorizationConfig;
  /** HTTP transform function */
  http?: FabricDataOperationConfig<T>["http"];
  /** Input transform function */
  transform?: FabricDataOperationConfig<T>["transform"];
}

// #endregion
