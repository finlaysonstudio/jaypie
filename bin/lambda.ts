#!/usr/bin/env tsx

/**
 * @fileoverview Lambda function local development client
 *
 * This script allows you to run Lambda function handlers locally by simulating
 * the AWS Lambda runtime environment. It supports loading event data from JSON files
 * and invoking specific exports from your Lambda function modules.
 *
 * @example
 * # Run with default handler and event.json
 * ./bin/lambda.ts packages/lambda/function.ts
 *
 * # Run with specific handler
 * ./bin/lambda.ts packages/lambda/function.ts handler
 *
 * # Run with specific event file
 * ./bin/lambda.ts packages/lambda/function.ts ./custom-event.json
 *
 * # Run with both specific handler and event file (order interchangeable)
 * ./bin/lambda.ts packages/lambda/function.ts handler event.json
 * ./bin/lambda.ts packages/lambda/function.ts event.json handler
 */

import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Determines if a given path is a JSON file based on extension or relative path format
 */
const isJsonFile = (filepath: string) =>
  filepath.endsWith(".json") || filepath.startsWith("./");

/**
 * Main execution function that handles command line arguments and invokes the Lambda handler
 */
/**
 * Type definition for a Lambda handler function
 */
type LambdaHandler = (
  event: unknown,
  context?: unknown,
) => Promise<unknown> | unknown;

/**
 * Type definition for a Lambda module
 */
type LambdaModule = {
  default?: LambdaHandler;
  handler?: LambdaHandler;
  [key: string]: LambdaHandler | undefined;
};

/**
 * Main execution function that handles command line arguments and invokes the Lambda handler
 * @throws {Error} If the specified file or handler cannot be loaded
 */
const main = async () => {
  const [, , filePath, param1, param2] = process.argv;
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error(
      "Usage: bin <file.ts> [exportName|event.json] [event.json|exportName]",
    );
    process.exit(1);
  }

  let eventFile: string | undefined;
  let exportName: string | undefined;

  // Determine which parameter is which based on format
  if (param1) {
    if (isJsonFile(param1)) {
      eventFile = param1;
      exportName = param2;
    } else {
      exportName = param1;
      eventFile = param2;
    }
  }

  let event = {};
  const eventPath = eventFile
    ? path.resolve(eventFile)
    : path.resolve("event.json");

  if (eventFile || fs.existsSync(eventPath)) {
    try {
      const eventContent = fs.readFileSync(eventPath, "utf-8");
      event = JSON.parse(eventContent);
    } catch (error) {
      if (eventFile) {
        // eslint-disable-next-line no-console
        console.error("Error reading event file:", error);
        process.exit(1);
      }
    }
  }

  try {
    const absolutePath = path.resolve(filePath);
    const moduleUrl = pathToFileURL(absolutePath).href;
    const module = (await import(moduleUrl)) as LambdaModule;

    if (exportName) {
      const handler = module[exportName];
      if (typeof handler === "function") {
        const response = await handler(event);
        // eslint-disable-next-line no-console
        console.dir(response, { depth: 3 });
      } else {
        // eslint-disable-next-line no-console
        console.error(`Export "${exportName}" not found or not a function.`);
        process.exit(1);
      }
    } else {
      if (typeof module.default === "function") {
        const response = await module.default(event);
        // eslint-disable-next-line no-console
        console.dir(response, { depth: 3 });
      } else if (typeof module.handler === "function") {
        const response = await module.handler(event);
        // eslint-disable-next-line no-console
        console.dir(response, { depth: 3 });
      } else {
        // eslint-disable-next-line no-console
        console.error("No callable function found (default or handler).");
        process.exit(1);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error loading module:", error);
    process.exit(1);
  }
};

main();
