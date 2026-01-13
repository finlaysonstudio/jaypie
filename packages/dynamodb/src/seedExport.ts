import { putEntity } from "./entities.js";
import { queryByAlias, queryByOu } from "./queries.js";
import type { FabricEntity } from "./types.js";

/**
 * Result of a seed operation
 */
export interface SeedResult {
  /** Aliases of entities that were created */
  created: string[];
  /** Error details for failed seed operations */
  errors: Array<{ alias: string; error: string }>;
  /** Aliases of entities that were skipped (already exist) */
  skipped: string[];
}

/**
 * Options for seed operations
 */
export interface SeedOptions {
  /** Preview without writing (default: false) */
  dryRun?: boolean;
  /** Overwrite existing entities (default: false) */
  replace?: boolean;
}

/**
 * Result of an export operation
 */
export interface ExportResult<T extends FabricEntity = FabricEntity> {
  /** Number of entities exported */
  count: number;
  /** Exported entities */
  entities: T[];
}

/**
 * Seed a single entity if it doesn't already exist
 *
 * @param entity - Partial entity with at least alias, model, and ou
 * @returns true if entity was created, false if it already exists
 */
export async function seedEntityIfNotExists<T extends Partial<FabricEntity>>(
  entity: T,
): Promise<boolean> {
  if (!entity.alias || !entity.model || !entity.ou) {
    throw new Error(
      "Entity must have alias, model, and ou to check existence",
    );
  }

  // Check if entity already exists
  const existing = await queryByAlias({
    alias: entity.alias,
    model: entity.model,
    ou: entity.ou,
  });

  if (existing) {
    return false;
  }

  // Generate required fields if missing
  const now = new Date().toISOString();
  const completeEntity: FabricEntity = {
    createdAt: entity.createdAt ?? now,
    id: entity.id ?? crypto.randomUUID(),
    model: entity.model,
    name: entity.name ?? entity.alias,
    ou: entity.ou,
    sequence: entity.sequence ?? Date.now(),
    updatedAt: entity.updatedAt ?? now,
    ...entity,
  } as FabricEntity;

  await putEntity({ entity: completeEntity });
  return true;
}

/**
 * Seed multiple entities (idempotent)
 *
 * - Checks existence by alias (via queryByAlias) before creating
 * - Auto-generates id (UUID), createdAt, updatedAt if missing
 * - Skip existing unless replace: true
 * - Returns counts of created/skipped/errors
 *
 * @param entities - Array of partial entities to seed
 * @param options - Seed options
 * @returns Result with created, skipped, and errors arrays
 */
export async function seedEntities<T extends Partial<FabricEntity>>(
  entities: T[],
  options: SeedOptions = {},
): Promise<SeedResult> {
  const { dryRun = false, replace = false } = options;
  const result: SeedResult = {
    created: [],
    errors: [],
    skipped: [],
  };

  for (const entity of entities) {
    const alias = entity.alias ?? entity.name ?? "unknown";

    try {
      if (!entity.model || !entity.ou) {
        throw new Error("Entity must have model and ou");
      }

      // For entities with alias, check existence
      if (entity.alias) {
        const existing = await queryByAlias({
          alias: entity.alias,
          model: entity.model,
          ou: entity.ou,
        });

        if (existing && !replace) {
          result.skipped.push(alias);
          continue;
        }

        // If replacing, use existing ID to update rather than create new
        if (existing && replace) {
          entity.id = existing.id;
        }
      }

      if (dryRun) {
        result.created.push(alias);
        continue;
      }

      // Generate required fields if missing
      const now = new Date().toISOString();
      const completeEntity: FabricEntity = {
        createdAt: entity.createdAt ?? now,
        id: entity.id ?? crypto.randomUUID(),
        model: entity.model,
        name: entity.name ?? entity.alias ?? "Unnamed",
        ou: entity.ou,
        sequence: entity.sequence ?? Date.now(),
        updatedAt: entity.updatedAt ?? now,
        ...entity,
      } as FabricEntity;

      await putEntity({ entity: completeEntity });
      result.created.push(alias);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push({ alias, error: errorMessage });
    }
  }

  return result;
}

/**
 * Export entities by model and organizational unit
 *
 * - Paginates through all matching entities via queryByOu
 * - Returns entities sorted by sequence (ascending)
 *
 * @param model - The entity model name
 * @param ou - The organizational unit
 * @param limit - Optional maximum number of entities to export
 * @returns Export result with entities and count
 */
export async function exportEntities<T extends FabricEntity>(
  model: string,
  ou: string,
  limit?: number,
): Promise<ExportResult<T>> {
  const entities: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  let remaining = limit;

  do {
    const batchLimit =
      remaining !== undefined ? Math.min(remaining, 100) : undefined;

    const { items, lastEvaluatedKey } = await queryByOu({
      ascending: true,
      limit: batchLimit,
      model,
      ou,
      startKey,
    });

    entities.push(...(items as T[]));
    startKey = lastEvaluatedKey;

    if (remaining !== undefined) {
      remaining -= items.length;
    }
  } while (startKey && (remaining === undefined || remaining > 0));

  return {
    count: entities.length,
    entities,
  };
}

/**
 * Export entities as a JSON string
 *
 * @param model - The entity model name
 * @param ou - The organizational unit
 * @param pretty - Format JSON with indentation (default: true)
 * @returns JSON string of exported entities
 */
export async function exportEntitiesToJson(
  model: string,
  ou: string,
  pretty: boolean = true,
): Promise<string> {
  const { entities } = await exportEntities(model, ou);
  return pretty ? JSON.stringify(entities, null, 2) : JSON.stringify(entities);
}
