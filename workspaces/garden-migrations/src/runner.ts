import {
  APEX,
  queryByAlias,
  transactWriteEntities,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";

import { migrations } from "./migrations/index.js";

//
//
// Constants
//

const MIGRATION_MODEL = "migration";

//
//
// Model Registration
//

const MIGRATION_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
];

registerModel({ model: MIGRATION_MODEL, indexes: MIGRATION_INDEXES });

//
//
// Types
//

export interface Migration {
  id: string;
  apply: () => Promise<StorableEntity[]>;
}

//
//
// Main
//

async function runMigrations(): Promise<void> {
  for (const migration of migrations) {
    // Check if already applied
    const existing = await queryByAlias({
      alias: migration.id,
      model: MIGRATION_MODEL,
      scope: APEX,
    });

    if (existing) {
      log.trace("Migration already applied, skipping", {
        migrationId: migration.id,
      });
      continue;
    }

    // Apply migration
    log.debug("Applying migration", { migrationId: migration.id });
    const entities = await migration.apply();

    // Write migration record + seeded entities atomically
    const now = new Date().toISOString();
    const sequence = Date.now();

    const migrationRecord: StorableEntity = {
      alias: migration.id,
      createdAt: now,
      id: migration.id,
      model: MIGRATION_MODEL,
      name: migration.id,
      scope: APEX,
      sequence,
      updatedAt: now,
    };

    await transactWriteEntities({
      entities: [...entities, migrationRecord],
    });

    log.debug("Migration applied", { migrationId: migration.id });
  }
}

//
//
// Export
//

export { runMigrations };
