import { initClient } from "@jaypie/dynamodb";
import { lambdaHandler } from "jaypie";

import { runMigrations } from "./src/runner.js";

//
//
// Constants
//

const PHYSICAL_RESOURCE_ID = "garden-migrations";

//
//
// Types
//

interface CustomResourceEvent {
  PhysicalResourceId?: string;
  RequestType?: "Create" | "Delete" | "Update" | string;
}

//
//
// Handler
//

export const handler = lambdaHandler(
  async (event: CustomResourceEvent) => {
    if (event.RequestType === "Delete") {
      return {
        PhysicalResourceId: event.PhysicalResourceId || PHYSICAL_RESOURCE_ID,
      };
    }

    await runMigrations();

    return {
      PhysicalResourceId: PHYSICAL_RESOURCE_ID,
    };
  },
  {
    name: "garden-migrations",
    secrets: ["PROJECT_SALT"],
    setup: [
      () => {
        initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
      },
    ],
  },
);
