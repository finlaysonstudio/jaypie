import { putEntity } from "./entities.js";
import { queryByAlias, queryByScope } from "./queries.js";
import type { StorableEntity } from "./types.js";

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
export interface ExportResult<T extends StorableEntity = StorableEntity> {
  /** Number of entities exported */
  count: number;
  /** Exported entities */
  entities: T[];
}

/**
 * Seed a single entity if it doesn't already exist
 *
 * @param entity - Partial entity with at least alias, model, and scope
 * @returns true if entity was created, false if it already exists
 */
export async function seedEntityIfNotExists<T extends Partial<StorableEntity>>(
  entity: T,
): Promise<boolean> {
  if (!entity.alias || !entity.model || !entity.scope) {
    throw new Error(
      "Entity must have alias, model, and scope to check existence",
    );
  }

  // Check if entity already exists
  const existing = await queryByAlias({
    alias: entity.alias,
    model: entity.model,
    scope: entity.scope,
  });

  if (existing) {
    return false;
  }

  // Generate required fields if missing
  const now = new Date().toISOString();
  const completeEntity: StorableEntity = {
    createdAt: entity.createdAt ?? now,
    id: entity.id ?? crypto.randomUUID(),
    model: entity.model,
    name: entity.name ?? entity.alias,
    scope: entity.scope,
    sequence: entity.sequence ?? Date.now(),
    updatedAt: entity.updatedAt ?? now,
    ...entity,
  } as StorableEntity;

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
export async function seedEntities<T extends Partial<StorableEntity>>(
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
      if (!entity.model || !entity.scope) {
        throw new Error("Entity must have model and scope");
      }

      // For entities with alias, check existence
      if (entity.alias) {
        const existing = await queryByAlias({
          alias: entity.alias,
          model: entity.model,
          scope: entity.scope,
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
      const completeEntity: StorableEntity = {
        createdAt: entity.createdAt ?? now,
        id: entity.id ?? crypto.randomUUID(),
        model: entity.model,
        name: entity.name ?? entity.alias ?? "Unnamed",
        scope: entity.scope,
        sequence: entity.sequence ?? Date.now(),
        updatedAt: entity.updatedAt ?? now,
        ...entity,
      } as StorableEntity;

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
 * Export entities by model and scope
 *
 * - Paginates through all matching entities via queryByScope
 * - Returns entities sorted by sequence (ascending)
 *
 * @param model - The entity model name
 * @param scope - The scope (APEX or "{parent.model}#{parent.id}")
 * @param limit - Optional maximum number of entities to export
 * @returns Export result with entities and count
 */
export async function exportEntities<T extends StorableEntity>(
  model: string,
  scope: string,
  limit?: number,
): Promise<ExportResult<T>> {
  const entities: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  let remaining = limit;

  do {
    const batchLimit =
      remaining !== undefined ? Math.min(remaining, 100) : undefined;

    const { items, lastEvaluatedKey } = await queryByScope({
      ascending: true,
      limit: batchLimit,
      model,
      scope,
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
 * @param scope - The scope (APEX or "{parent.model}#{parent.id}")
 * @param pretty - Format JSON with indentation (default: true)
 * @returns JSON string of exported entities
 */
export async function exportEntitiesToJson(
  model: string,
  scope: string,
  pretty: boolean = true,
): Promise<string> {
  const { entities } = await exportEntities(model, scope);
  return pretty ? JSON.stringify(entities, null, 2) : JSON.stringify(entities);
}
