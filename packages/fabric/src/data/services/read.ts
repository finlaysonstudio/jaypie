import { BadRequestError, NotFoundError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService } from "../../http/types.js";
import type {
  FabricDataConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
} from "../types.js";
import { transformRead } from "../transforms.js";

/**
 * Create the "read" service for a FabricData endpoint
 * GET /{model}/:id - Get a single entity by ID
 */
export function createReadService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name } = modelConfig;

  return fabricHttp({
    alias: `read-${alias}`,
    description: `Get a ${name} by ID`,
    input: {
      id: { type: String, description: `${name} ID` },
    },
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: operationConfig.http ?? transformRead,
    service: async (input: Record<string, unknown>) => {
      // Dynamically import DynamoDB utilities
      const { getEntity } = await import("@jaypie/dynamodb");

      const id = input.id as string | undefined;

      if (!id) {
        throw new BadRequestError("ID is required");
      }

      // Fetch the entity
      const entity = await getEntity({ id, model: alias });

      if (!entity) {
        throw new NotFoundError(`${name} not found`);
      }

      return entity;
    },
  }) as unknown as FabricHttpService;
}
