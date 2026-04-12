import { BadRequestError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService, HttpContext } from "../../http/types.js";
import type { ServiceContext } from "../../types.js";
import type {
  FabricDataConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
  ScopeFunction,
} from "../types.js";
import { calculateScopeFromConfig, transformCreate } from "../transforms.js";

interface CreateServiceContext extends ServiceContext {
  http?: HttpContext;
}

/**
 * Create the "create" service for a FabricData endpoint
 * POST /{model} - Create a new entity
 */
export function createCreateService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name } = modelConfig;

  return fabricHttp({
    alias: `create-${alias}`,
    description: `Create a new ${name}`,
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: operationConfig.http ?? transformCreate,
    service: async (
      input: Record<string, unknown>,
      context?: CreateServiceContext,
    ) => {
      // Dynamically import DynamoDB utilities
      const { putEntity } = await import("@jaypie/dynamodb");

      // Calculate scope
      const scopeConfig = globalConfig.scope as
        | ScopeFunction
        | string
        | undefined;
      const httpContext = context?.http;
      const scope = httpContext
        ? await calculateScopeFromConfig(scopeConfig, httpContext)
        : "@";

      // Validate required fields
      if (!input || typeof input !== "object") {
        throw new BadRequestError("Request body is required");
      }

      // Apply transform if configured
      let entityInput = input;
      if (operationConfig.transform) {
        entityInput = {
          ...entityInput,
          ...operationConfig.transform(entityInput, null),
        };
      }

      // Build the entity; createdAt/updatedAt managed by indexEntity on write
      const entity = {
        ...entityInput,
        id: crypto.randomUUID(),
        model: alias,
        name: (entityInput.name as string) ?? name,
        scope,
      };

      // indexEntity on the dynamodb side fills createdAt/updatedAt/GSI attrs.
      const created = await putEntity({ entity });
      return created;
    },
  }) as unknown as FabricHttpService;
}
