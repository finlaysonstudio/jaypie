#!/usr/bin/env tsx

import "dotenv/config";
import path from "path";

async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 1) {
      console.error("Usage: tool <file-path> [export-name] [params...]");
      process.exit(1);
    }

    const [filePath, possibleExportName, ...possibleParams] = args;

    // Resolve the file path relative to the current working directory
    const resolvedPath = path.resolve(process.cwd(), filePath);

    // Import the file dynamically
    const fileModule = await import(resolvedPath);

    // Get the filename without extension to use as fallback export name
    const fileName = path.basename(filePath, path.extname(filePath));

    // Try to get the specified export or use filename as fallback
    let exportedTool = null;
    let params = possibleParams;

    if (possibleExportName) {
      // First try with the provided export name
      exportedTool = fileModule[possibleExportName];
    }

    if (!exportedTool) {
      // If no export name provided or not found, try using the filename
      exportedTool = fileModule[fileName];

      // If an invalid export name was provided, treat it as the first parameter
      if (possibleExportName) {
        params = [possibleExportName, ...possibleParams];
      }
    }

    if (!exportedTool) {
      console.error(
        `No valid export found in ${filePath}. Tried '${possibleExportName || ""}' and '${fileName}'`,
      );
      process.exit(1);
    }

    // Check if the export has a call function
    if (typeof exportedTool.call !== "function") {
      console.error(`Export does not have a 'call' function`);
      process.exit(1);
    }

    // Parse parameters
    let parsedParams = {};
    if (params.length > 0) {
      // Check if the first parameter looks like a JSON object
      const firstParam = params[0];
      const trimmedFirstParam = firstParam.trim();

      if (
        trimmedFirstParam.startsWith("{") &&
        trimmedFirstParam.endsWith("}")
      ) {
        // It looks like JSON, try to parse it
        try {
          parsedParams = JSON.parse(params.join(" "));
        } catch (error) {
          console.error("Error parsing JSON parameters:", error.message);
          process.exit(1);
        }
      } else {
        // Not JSON, assume it's a date parameter for the time tool
        parsedParams = { date: firstParam };
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
