import { TYPE } from "./constants.js";
import type { ValidationType } from "./constants.js";
import force from "./force.function.js";
import type { ForceFunction, ForceOptions } from "./force.function.js";
import isClass from "./isClass.function.js";
import optional from "./optional.function.js";
import type { OptionalFunction, OptionalOptions } from "./optional.function.js";
import required from "./required.function.js";
import type { RequiredFunction, RequiredOptions } from "./required.function.js";
import validate from "./validate.function.js";
import type { ValidateFunction, ValidateOptions } from "./validate.function.js";

//
//
// Export
//

export default validate;
export { force, isClass, optional, required, TYPE };
export type {
  ForceFunction,
  ForceOptions,
  OptionalFunction,
  OptionalOptions,
  RequiredFunction,
  RequiredOptions,
  ValidateFunction,
  ValidateOptions,
  ValidationType,
};
