import { BadRequestError, NotFoundError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService } from "../../http/types.js";
import type {
  FabricDataConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
} from "../types.js";
import { transformArchive } from "../transforms.js";

/**
 * Create the "archive" service for a FabricData endpoint
 * POST /{model}/:id/archive - Archive an entity
 */
export function createArchiveService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  operationConfig: ResolvedOperationConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias, name } = modelConfig;

  return fabricHttp({
    alias: `archive-${alias}`,
    description: `Archive a ${name}`,
    input: {
      id: { type: String, description: `${name} ID` },
    },
    authorization: operationConfig.authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: operationConfig.http ?? transformArchive,
    service: async (input: Record<string, unknown>) => {
      // Dynamically import DynamoDB utilities
      const { archiveEntity, getEntity } = await import("@jaypie/dynamodb");

      const id = input.id as string | undefined;

      if (!id) {
        throw new BadRequestError("ID is required");
      }

      // Check if entity exists
      const existing = await getEntity({ id, model: alias });

      if (!existing) {
        throw new NotFoundError(`${name} not found`);
      }

      // Archive the entity
      const archived = await archiveEntity({ id, model: alias });

      if (!archived) {
        throw new NotFoundError(`${name} not found`);
      }

      // Fetch the updated entity to return
      const updated = await getEntity({ id, model: alias });
      return updated;
    },
  }) as unknown as FabricHttpService;
}
