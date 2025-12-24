import { BadRequestError } from "@jaypie/errors";

import { log } from "../../core.js";
import { TYPE, ValidationType } from "./constants.js";
import validate from "./validate.function.js";

const libLog = log.lib({ lib: "@jaypie/core" });

//
//
// Types
//

interface OptionalOptions {
  positive?: boolean;
}

interface OptionalFunction {
  (value: unknown, type: ValidationType, options?: OptionalOptions): boolean;
  array: (value: unknown) => boolean;
  boolean: (value: unknown) => boolean;
  number: (value: unknown) => boolean;
  object: (value: unknown) => boolean;
  positive: (value: unknown) => boolean;
  string: (value: unknown, defaultValue?: string) => boolean;
}

//
//
// Main
//

const optional: OptionalFunction = (
  value: unknown,
  type: ValidationType,
  options: OptionalOptions = {},
): boolean => {
  libLog.warn(
    "[deprecated] optional() is deprecated and will be removed in a future version",
  );
  if (value === undefined) {
    // Type=Any, Required=False is always true
    return validate(value, { type: TYPE.ANY, required: false });
  }
  switch (type) {
    case TYPE.ANY:
      return validate(value, { type: TYPE.ANY, required: false });
    case TYPE.ARRAY:
      return validate(value, { type: TYPE.ARRAY, required: false });
    case TYPE.BOOLEAN:
      return validate(value, { type: TYPE.BOOLEAN, required: false });
    case TYPE.NUMBER:
      if (options.positive) {
        const validPositive = validate(value, {
          type: TYPE.NUMBER,
          ...options,
        });
        if ((value as number) <= 0) {
          throw new BadRequestError(
            `Argument "${value}" doesn't match required value for type "positive"`,
          );
        }
        return validPositive;
      }
      return validate(value, { type: TYPE.NUMBER, required: false });
    case TYPE.OBJECT:
      return validate(value, { type: TYPE.OBJECT, required: false });
    case TYPE.STRING:
      return validate(value, { type: TYPE.STRING, required: false });
    default:
      throw TypeError(`Unsupported type, "${type}"`);
  }
};

//
//
// Convenience Functions
//

optional.array = (value: unknown): boolean => optional(value, Array);
optional.boolean = (value: unknown): boolean => optional(value, Boolean);
optional.number = (value: unknown): boolean => optional(value, Number);
optional.object = (value: unknown): boolean => optional(value, Object);
optional.positive = (value: unknown): boolean =>
  optional(value, Number, { positive: true });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
optional.string = (value: unknown, _defaultValue = ""): boolean =>
  optional(value, String);

export default optional;
export type { OptionalFunction, OptionalOptions };
