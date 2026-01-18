import { BadRequestError, NotFoundError } from "@jaypie/errors";

import type { FabricModel } from "../../models/base.js";
import { fabricHttp } from "../../http/fabricHttp.js";
import type { FabricHttpService } from "../../http/types.js";
import type {
  FabricDataConfig,
  FabricDataExecuteConfig,
  ResolvedModelConfig,
} from "../types.js";
import { transformExecute } from "../transforms.js";

/**
 * Create an "execute" service for a custom action
 * POST /{model}/:id/{alias} - Execute a custom action on an entity
 */
export function createExecuteService<T extends FabricModel = FabricModel>(
  modelConfig: ResolvedModelConfig,
  executeConfig: FabricDataExecuteConfig<T>,
  globalConfig: FabricDataConfig<T>,
): FabricHttpService {
  const { alias: modelAlias, name: modelName } = modelConfig;
  const {
    alias: actionAlias,
    authorization,
    description,
    input: inputDefinition,
    service: actionService,
  } = executeConfig;

  return fabricHttp({
    alias: `${modelAlias}-${actionAlias}`,
    description: description ?? `${actionAlias} action on ${modelName}`,
    input: {
      id: { type: String, description: `${modelName} ID` },
      ...inputDefinition,
    },
    authorization: authorization ?? globalConfig.authorization,
    cors: globalConfig.cors,
    http: transformExecute,
    service: async (input: Record<string, unknown>) => {
      // Dynamically import DynamoDB utilities
      const { getEntity } = await import("@jaypie/dynamodb");

      const id = input.id as string | undefined;
      const { id: _id, ...actionInput } = input;

      if (!id) {
        throw new BadRequestError("ID is required");
      }

      // Fetch the entity
      const entity = await getEntity({ id, model: modelAlias });

      if (!entity) {
        throw new NotFoundError(`${modelName} not found`);
      }

      // Execute the action
      const result = await actionService(entity as unknown as T, actionInput);
      return result;
    },
  }) as unknown as FabricHttpService;
}
