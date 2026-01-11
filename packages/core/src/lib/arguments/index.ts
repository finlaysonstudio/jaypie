import { TYPE } from "./constants.js";
import type { ValidationType } from "./constants.js";
import optional from "./optional.function.js";
import type { OptionalFunction, OptionalOptions } from "./optional.function.js";
import required from "./required.function.js";
import type { RequiredFunction, RequiredOptions } from "./required.function.js";
import validate from "./validate.function.js";
import type { ValidateFunction, ValidateOptions } from "./validate.function.js";

// Re-export from kit
export { force, isClass } from "@jaypie/kit";
export type { ForceFunction, ForceOptions } from "@jaypie/kit";

//
//
// Export
//

export default validate;
export { optional, required, TYPE };
export type {
  OptionalFunction,
  OptionalOptions,
  RequiredFunction,
  RequiredOptions,
  ValidateFunction,
  ValidateOptions,
  ValidationType,
};
