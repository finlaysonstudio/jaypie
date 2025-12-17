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
const packageCache = new Map<string, unknown>();

export function loadPackage<T>(packageName: string): T {
  if (packageCache.has(packageName)) {
    return packageCache.get(packageName) as T;
  }

  try {
    // eslint-disable-next-line no-restricted-syntax
    const pkg = require(packageName) as T;
    packageCache.set(packageName, pkg);
    return pkg;
  } catch (error) {
    const resolveAttempt = safeResolve(packageName);
    const err = error as Error & { code?: string };
    // eslint-disable-next-line no-console
    console.error(`[jaypie] loadPackage failed for "${packageName}"`, {
      importMetaUrl: import.meta.url,
      resolveAttempt,
      errorCode: err.code,
      errorMessage: err.message,
    });
    throw new ConfigurationError(
      `${packageName} is required but not installed. Run: npm install ${packageName}`,
    );
  }
}

function safeResolve(packageName: string): string | null {
  try {
    return require.resolve(packageName);
  } catch {
    return null;
  }
}
