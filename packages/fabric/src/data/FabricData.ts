import type { FabricModel } from "../models/base.js";
import type { FabricHttpService } from "../http/types.js";
import type {
  FabricDataConfig,
  FabricDataOperationOption,
  FabricDataResult,
  FabricModelConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
} from "./types.js";
import { capitalize, pluralize } from "./transforms.js";
import {
  createArchiveService,
  createCreateService,
  createDeleteService,
  createExecuteService,
  createListService,
  createReadService,
  createUpdateService,
} from "./services/index.js";

/**
 * Resolve model configuration from string or object
 */
function resolveModelConfig(
  model: string | FabricModelConfig,
): ResolvedModelConfig {
  if (typeof model === "string") {
    return {
      alias: model,
      description: undefined,
      name: capitalize(model),
      pluralAlias: pluralize(model),
    };
  }

  return {
    alias: model.alias,
    description: model.description,
    name: model.name ?? capitalize(model.alias),
    pluralAlias: pluralize(model.alias),
  };
}

/**
 * Resolve operation configuration from boolean or object
 */
function resolveOperationConfig<T extends FabricModel>(
  option: FabricDataOperationOption<T> | undefined,
  defaultEnabled: boolean = true,
): ResolvedOperationConfig<T> {
  // Undefined means use defaults (enabled)
  if (option === undefined) {
    return { enabled: defaultEnabled };
  }

  // Boolean means enabled/disabled with defaults
  if (typeof option === "boolean") {
    return { enabled: option };
  }

  // Object config
  return {
    authorization: option.authorization,
    enabled: option.enabled !== false,
    http: option.http,
    transform: option.transform,
  };
}

/**
 * Create CRUD HTTP services for a Jaypie model backed by DynamoDB
 *
 * Generates standard operations:
 * - POST /{model} - Create
 * - GET /{model} - List
 * - GET /{model}/:id - Read
 * - POST /{model}/:id - Update
 * - DELETE /{model}/:id - Delete
 * - POST /{model}/:id/archive - Archive
 * - POST /{model}/:id/{action} - Custom execute actions
 *
 * @example
 * ```typescript
 * // Basic usage
 * const recordServices = FabricData({ model: "record" });
 *
 * // With authorization
 * const recordServices = FabricData({
 *   model: "record",
 *   authorization: validateToken,
 *   operations: {
 *     read: { authorization: false }, // Public read
 *     delete: { authorization: requireAdmin },
 *     archive: false, // Disabled
 *   },
 * });
 *
 * // Use with FabricHttpServer
 * const server = new FabricHttpServer({
 *   services: recordServices.services,
 *   prefix: "/api",
 * });
 * ```
 */
export function FabricData<T extends FabricModel = FabricModel>(
  config: FabricDataConfig<T>,
): FabricDataResult {
  const modelConfig = resolveModelConfig(config.model);
  const { alias, pluralAlias } = modelConfig;

  const services: FabricHttpService[] = [];

  // Resolve operation configs
  const operations = config.operations ?? {};

  // Create operation
  const createOp = resolveOperationConfig<T>(operations.create);
  if (createOp.enabled) {
    services.push(createCreateService(modelConfig, createOp, config));
  }

  // List operation
  const listOp = resolveOperationConfig<T>(operations.list);
  if (listOp.enabled) {
    services.push(createListService(modelConfig, listOp, config));
  }

  // Read operation
  const readOp = resolveOperationConfig<T>(operations.read);
  if (readOp.enabled) {
    services.push(createReadService(modelConfig, readOp, config));
  }

  // Update operation
  const updateOp = resolveOperationConfig<T>(operations.update);
  if (updateOp.enabled) {
    services.push(createUpdateService(modelConfig, updateOp, config));
  }

  // Delete operation
  const deleteOp = resolveOperationConfig<T>(operations.delete);
  if (deleteOp.enabled) {
    services.push(createDeleteService(modelConfig, deleteOp, config));
  }

  // Archive operation
  const archiveOp = resolveOperationConfig<T>(operations.archive);
  if (archiveOp.enabled) {
    services.push(createArchiveService(modelConfig, archiveOp, config));
  }

  // Execute actions
  if (config.execute) {
    for (const executeConfig of config.execute) {
      services.push(createExecuteService(modelConfig, executeConfig, config));
    }
  }

  return {
    model: alias,
    prefix: `/${pluralAlias}`,
    services,
  };
}

/**
 * Check if a value is a FabricDataResult
 */
export function isFabricDataResult(value: unknown): value is FabricDataResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.model === "string" &&
    typeof obj.prefix === "string" &&
    Array.isArray(obj.services)
  );
}
