import { BadRequestError, NotFoundError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService } from "../../http/types.js";
import type {
  FabricDataConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
} from "../types.js";
import { transformUpdate } from "../transforms.js";

/**
 * Create the "update" service for a FabricData endpoint
 * POST /{model}/:id - Update an existing entity
 */
export function createUpdateService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name } = modelConfig;

  return fabricHttp({
    alias: `update-${alias}`,
    description: `Update a ${name}`,
    input: {
      id: { type: String, description: `${name} ID` },
    },
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: operationConfig.http ?? transformUpdate,
    service: async (input: Record<string, unknown>) => {
      // Dynamically import DynamoDB utilities
      const { getEntity, updateEntity } = await import("@jaypie/dynamodb");

      const id = input.id as string | undefined;
      const { id: _id, ...updateData } = input;

      if (!id) {
        throw new BadRequestError("ID is required");
      }

      // Fetch existing entity
      const existing = await getEntity({ id, model: alias });

      if (!existing) {
        throw new NotFoundError(`${name} not found`);
      }

      // Apply transform if configured
      let entityUpdate = updateData;
      if (operationConfig.transform) {
        entityUpdate = {
          ...entityUpdate,
          ...operationConfig.transform(updateData, existing as unknown as T),
        };
      }

      // Build the updated entity
      const entity = {
        ...existing,
        ...entityUpdate,
        // Preserve immutable fields
        createdAt: existing.createdAt,
        id: existing.id,
        model: existing.model,
        scope: existing.scope,
        sequence: existing.sequence,
      };

      // Update the entity
      const updated = await updateEntity({ entity });
      return updated;
    },
  }) as unknown as FabricHttpService;
}
