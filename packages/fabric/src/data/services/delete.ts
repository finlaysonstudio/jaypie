import { BadRequestError, NotFoundError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService } from "../../http/types.js";
import type {
  FabricDataConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
} from "../types.js";
import { transformDelete } from "../transforms.js";

/**
 * Create the "delete" service for a FabricData endpoint
 * DELETE /{model}/:id - Soft delete an entity
 */
export function createDeleteService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name } = modelConfig;

  return fabricHttp({
    alias: `delete-${alias}`,
    description: `Delete a ${name}`,
    input: {
      id: { type: String, description: `${name} ID` },
    },
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: operationConfig.http ?? transformDelete,
    service: async (input: Record<string, unknown>) => {
      // Dynamically import DynamoDB utilities
      const { deleteEntity, getEntity } = await import("@jaypie/dynamodb");

      const id = input.id as string | undefined;

      if (!id) {
        throw new BadRequestError("ID is required");
      }

      // Check if entity exists
      const existing = await getEntity({ id, model: alias });

      if (!existing) {
        throw new NotFoundError(`${name} not found`);
      }

      // Soft delete the entity
      const deleted = await deleteEntity({ id, model: alias });

      if (!deleted) {
        throw new NotFoundError(`${name} not found`);
      }

      // Return success (no content)
      return null;
    },
  }) as unknown as FabricHttpService;
}
