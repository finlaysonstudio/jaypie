#!/usr/bin/env tsx
/* eslint-disable no-console */

import "dotenv/config";
import path from "path";

async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.error("Usage: tool <file-path> <export-name> [params...]");
      process.exit(1);
    }

    const [filePath, exportName, ...params] = args;

    // Resolve the file path relative to the current working directory
    const resolvedPath = path.resolve(process.cwd(), filePath);

    // Import the file dynamically
    const fileModule = await import(resolvedPath);

    // Get the specified export
    const exportedTool = fileModule[exportName];

    if (!exportedTool) {
      console.error(`Export '${exportName}' not found in ${filePath}`);
      process.exit(1);
    }

    // Check if the export has a call function
    if (typeof exportedTool.call !== "function") {
      console.error(`Export '${exportName}' does not have a 'call' function`);
      process.exit(1);
    }

    // Parse parameters
    let parsedParams = {};
    if (params.length > 0) {
      try {
        // Join all remaining parameters in case they were split by spaces
        const paramsString = params.join(" ");
        parsedParams = JSON.parse(paramsString);
      } catch (error) {
        console.error("Error parsing parameters:", error.message);
        process.exit(1);
      }
    }

    // Call the function with the parameters
    const result = await exportedTool.call(parsedParams);

    // Output the result
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
