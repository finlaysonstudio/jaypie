import { initClient } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

import { runMigrations } from "./src/runner.js";

//
//
// Main
//

async function main(): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  log.debug("Running migrations", { endpoint, tableName });

  initClient({ endpoint, tableName });

  await runMigrations();

  log.debug("Migrations complete");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
