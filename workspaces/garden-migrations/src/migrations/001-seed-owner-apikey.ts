import { APEX, type StorableEntity } from "@jaypie/dynamodb";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";
import { generateJaypieKey, hashJaypieKey } from "jaypie";

//
//
// Constants
//

const APIKEY_MODEL = "apikey";

//
//
// Model Registration
//

const APIKEY_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
];

registerModel({ model: APIKEY_MODEL, indexes: APIKEY_INDEXES });

//
//
// Main
//

async function apply(): Promise<StorableEntity[]> {
  const seed = process.env.PROJECT_ADMIN_SEED;

  if (!seed) {
    log.warn(
      "Skipping owner API key seed: PROJECT_ADMIN_SEED is not available",
    );
    return [];
  }

  const key = generateJaypieKey({ issuer: "jaypie", seed });
  const hash = hashJaypieKey(key, { salt: "" });
  const now = new Date().toISOString();

  const entity: StorableEntity = {
    alias: hash,
    category: "owner",
    createdAt: now,
    id: crypto.randomUUID(),
    model: APIKEY_MODEL,
    name: "Owner Key",
    scope: APEX,
    sequence: Date.now(),
    type: "seed",
    updatedAt: now,
  };

  log.debug("Seeding owner API key", { label: key.slice(-4) });

  return [entity];
}

//
//
// Export
//

export default {
  apply,
  id: "001-seed-owner-apikey",
};
