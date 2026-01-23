import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type {
  FabricHttpService,
  HttpContext,
  HttpTransformFunction,
} from "../../http/types.js";
import type { ServiceContext } from "../../types.js";
import type {
  FabricDataConfig,
  FabricDataListResponse,
  ResolvedModelConfig,
  ResolvedOperationConfig,
  ScopeFunction,
} from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../types.js";
import {
  calculateScopeFromConfig,
  decodeCursor,
  encodeCursor,
  transformList,
} from "../transforms.js";

interface ListServiceContext extends ServiceContext {
  http?: HttpContext;
}

/**
 * Create the "list" service for a FabricData endpoint
 * GET /{model} - List entities with pagination
 */
export function createListService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name, pluralAlias } = modelConfig;
  const defaultLimit = globalConfig.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = globalConfig.maxLimit ?? MAX_LIMIT;

  // Build the HTTP transform function
  const httpTransform: HttpTransformFunction<Record<string, unknown>> =
    operationConfig.http ??
    ((context: HttpContext) =>
      transformList(context, defaultLimit, maxLimit) as unknown as Record<
        string,
        unknown
      >);

  return fabricHttp({
    alias: `list-${pluralAlias}`,
    description: `List ${name} entities`,
    input: {
      archived: {
        type: Boolean,
        default: false,
        required: false,
        description: "Include archived entities",
      },
      ascending: {
        type: Boolean,
        default: false,
        required: false,
        description: "Sort ascending by sequence",
      },
      cursor: {
        type: String,
        required: false,
        description: "Pagination cursor",
      },
      deleted: {
        type: Boolean,
        default: false,
        required: false,
        description: "Include deleted entities",
      },
      limit: {
        type: Number,
        default: defaultLimit,
        required: false,
        description: `Number of items per page (max: ${maxLimit})`,
      },
    },
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: httpTransform,
    service: async (
      input: Record<string, unknown>,
      context?: ListServiceContext,
    ) => {
      // Dynamically import DynamoDB utilities
      const { queryByScope } = await import("@jaypie/dynamodb");

      // Calculate scope
      const scopeConfig = globalConfig.scope as
        | ScopeFunction
        | string
        | undefined;
      const httpContext = context?.http;
      const scope = httpContext
        ? await calculateScopeFromConfig(scopeConfig, httpContext)
        : "@";

      // Parse input with defaults
      const archived = (input.archived as boolean | undefined) ?? false;
      const ascending = (input.ascending as boolean | undefined) ?? false;
      const deleted = (input.deleted as boolean | undefined) ?? false;
      const limit = Math.min(
        (input.limit as number | undefined) ?? defaultLimit,
        maxLimit,
      );
      const startKey = decodeCursor(
        (input.cursor as string | undefined) ??
          (input.startKey as string | undefined),
      );

      // Query entities
      const result = await queryByScope({
        archived,
        ascending,
        deleted,
        limit,
        model: alias,
        scope,
        startKey,
      });

      // Build response
      const response: FabricDataListResponse = {
        items: result.items,
        nextKey: encodeCursor(result.lastEvaluatedKey),
      };

      return response;
    },
  }) as unknown as FabricHttpService;
}
