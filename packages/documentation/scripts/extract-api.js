#!/usr/bin/env node

const { Extractor, ExtractorConfig } = require("@microsoft/api-extractor");
const path = require("path");
const fs = require("fs");

const PACKAGES_DIR = path.resolve(__dirname, "../../");
const TEMP_DIR = path.resolve(__dirname, "../temp");

const TS_PACKAGES = [
  "constructs",
  "errors",
  "kit",
  "llm",
  "logger",
  "mcp",
  "testkit",
  "textract",
  "types",
  "webkit",
];

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log("Extracting API documentation...\n");

let successCount = 0;
let errorCount = 0;

for (const packageName of TS_PACKAGES) {
  const packagePath = path.join(PACKAGES_DIR, packageName);
  const configPath = path.join(__dirname, "../api-extractor.json");

  const dtsPath1 = path.join(packagePath, "dist/index.d.ts");
  const dtsPath2 = path.join(packagePath, "dist/esm/index.d.ts");

  let mainEntryPointFilePath;
  if (fs.existsSync(dtsPath1)) {
    mainEntryPointFilePath = dtsPath1;
  } else if (fs.existsSync(dtsPath2)) {
    mainEntryPointFilePath = dtsPath2;
  } else {
    console.log(`⚠️  Skipping ${packageName}: No .d.ts file found`);
    continue;
  }

  try {
    console.log(`Processing @jaypie/${packageName}...`);

    const extractorConfig = ExtractorConfig.prepare({
      configObject: {
        $schema: "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
        projectFolder: packagePath,
        mainEntryPointFilePath,
        bundledPackages: [],
        compiler: {
          tsconfigFilePath: path.join(packagePath, "tsconfig.json"),
        },
        apiReport: {
          enabled: false,
        },
        docModel: {
          enabled: true,
          apiJsonFilePath: path.join(TEMP_DIR, `${packageName}.api.json`),
        },
        dtsRollup: {
          enabled: false,
        },
        tsdocMetadata: {
          enabled: false,
        },
        messages: {
          compilerMessageReporting: {
            default: {
              logLevel: "warning",
            },
          },
          extractorMessageReporting: {
            default: {
              logLevel: "warning",
              addToApiReportFile: false,
            },
            "ae-missing-release-tag": {
              logLevel: "none",
            },
            "ae-internal-missing-underscore": {
              logLevel: "none",
            },
          },
          tsdocMessageReporting: {
            default: {
              logLevel: "warning",
            },
          },
        },
      },
      configObjectFullPath: configPath,
      packageJsonFullPath: path.join(packagePath, "package.json"),
    });

    const extractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: false,
    });

    if (extractorResult.succeeded) {
      console.log(`✅ @jaypie/${packageName} - API extracted successfully\n`);
      successCount++;
    } else {
      console.log(`❌ @jaypie/${packageName} - API extraction completed with errors\n`);
      errorCount++;
    }
  } catch (error) {
    console.error(`❌ @jaypie/${packageName} - Error:`, error.message, "\n");
    errorCount++;
  }
}

console.log("\n" + "=".repeat(50));
console.log(`API Extraction Summary:`);
console.log(`  ✅ Success: ${successCount}`);
console.log(`  ❌ Errors: ${errorCount}`);
console.log(`  📁 Output: ${TEMP_DIR}`);
console.log("=".repeat(50) + "\n");

process.exit(errorCount > 0 ? 1 : 0);
