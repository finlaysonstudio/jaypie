import { createRequire } from "module";
import { pathToFileURL } from "url";

import { ConfigurationError } from "@jaypie/errors";

// CJS/ESM compatible require - handles bundling to CJS where import.meta.url becomes undefined
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __filename exists in CJS context when ESM is bundled to CJS
const require =
  typeof __filename !== "undefined"
    ? createRequire(pathToFileURL(__filename).href)
    : createRequire(import.meta.url);

// Cache for loaded packages
const packageCache = new Map<string, unknown>();

// Try to load a package, return null if not installed
function tryLoadPackage<T>(packageName: string): T | null {
  if (packageCache.has(packageName)) {
    return packageCache.get(packageName) as T;
  }

  try {
    // eslint-disable-next-line no-restricted-syntax
    const pkg = require(packageName) as T;
    packageCache.set(packageName, pkg);
    return pkg;
  } catch {
    return null;
  }
}

// Create a proxy that throws helpful error when accessing properties of uninstalled package
function createMissingPackageProxy(packageName: string): unknown {
  return new Proxy(
    {},
    {
      get(_, prop) {
        throw new ConfigurationError(
          `Cannot mock ${packageName}.${String(prop)} - ${packageName} is not installed. ` +
            `Run: npm install ${packageName}`,
        );
      },
    },
  );
}

// Load package or return proxy that throws errors
function loadPackageOrProxy<T>(packageName: string): T {
  return (tryLoadPackage<T>(packageName) ??
    createMissingPackageProxy(packageName)) as T;
}

// Core packages - always required
import * as errors from "@jaypie/errors";
import * as kit from "@jaypie/kit";
import * as logger from "@jaypie/logger";

// Optional packages - lazy loaded with validation
const aws = loadPackageOrProxy<typeof import("@jaypie/aws")>("@jaypie/aws");
const datadog =
  loadPackageOrProxy<typeof import("@jaypie/datadog")>("@jaypie/datadog");
const express =
  loadPackageOrProxy<typeof import("@jaypie/express")>("@jaypie/express");
const lambda =
  loadPackageOrProxy<typeof import("@jaypie/lambda")>("@jaypie/lambda");
const llm = loadPackageOrProxy<typeof import("@jaypie/llm")>("@jaypie/llm");
const mongoose =
  loadPackageOrProxy<typeof import("@jaypie/mongoose")>("@jaypie/mongoose");
const textract =
  loadPackageOrProxy<typeof import("@jaypie/textract")>("@jaypie/textract");

export const original = {
  aws,
  datadog,
  errors,
  express,
  kit,
  lambda,
  llm,
  logger,
  mongoose,
  textract,
};

export default original;
