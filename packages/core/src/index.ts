//
//
// Export
//

// Argument Validation (validate stays local, force/isClass from kit)
export {
  default as validate,
  optional,
  required,
  TYPE as VALIDATE,
} from "./lib/arguments.lib.js";
export { force, isClass } from "@jaypie/kit";

// Constants (stay local - both core and kit have identical copies)
export { JAYPIE, PROJECT } from "./core.js";

// Handler (from kit)
export { jaypieHandler } from "@jaypie/kit";

// Errors (stay local - re-export from @jaypie/errors)
export * from "./lib/errors.lib.js";

// Functions (from kit)
export {
  cloneDeep,
  envBoolean,
  envsKey,
  formatError,
  getHeaderFrom,
  getObjectKeyCaseInsensitive,
  placeholders,
  resolveValue,
  safeParseFloat,
  sleep,
} from "@jaypie/kit";

// HTTP (from kit)
export { HTTP } from "@jaypie/kit";

// Log (stays local)
export { log } from "./core.js";

// Utilities
export { uuid } from "@jaypie/kit";
