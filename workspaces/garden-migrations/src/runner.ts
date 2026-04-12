import {
  APEX,
  queryByAlias,
  transactWriteEntities,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { fabricIndex, registerModel } from "@jaypie/fabric";
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

registerModel({
  model: MIGRATION_MODEL,
  indexes: [fabricIndex(), fabricIndex("alias")],
});

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

    log.debug("Applying migration", { migrationId: migration.id });
    const entities = await migration.apply();

    const migrationRecord: StorableEntity = {
      alias: migration.id,
      id: migration.id,
      model: MIGRATION_MODEL,
      name: migration.id,
      scope: APEX,
    } as StorableEntity;

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
