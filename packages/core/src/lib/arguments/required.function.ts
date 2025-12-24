import { BadRequestError } from "@jaypie/errors";

import { log } from "../../core.js";
import { TYPE, ValidationType } from "./constants.js";
import validate from "./validate.function.js";

const libLog = log.lib({ lib: "@jaypie/core" });

//
//
// Types
//

interface RequiredOptions {
  positive?: boolean;
}

interface RequiredFunction {
  (value: unknown, type: ValidationType, options?: RequiredOptions): boolean;
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

const required: RequiredFunction = (
  value: unknown,
  type: ValidationType,
  options: RequiredOptions = {},
): boolean => {
  libLog.warn(
    "[deprecated] required() is deprecated and will be removed in a future version",
  );
  switch (type) {
    case TYPE.ARRAY:
      return validate(value, { type: TYPE.ARRAY, required: true });
    case TYPE.BOOLEAN:
      validate(value, { type: TYPE.BOOLEAN });
      if (!value) {
        throw new BadRequestError(
          `Argument "${value}" doesn't match required value "true" for type "boolean"`,
        );
      }
      return true;
    case TYPE.NUMBER:
      validate(value, {
        type: TYPE.NUMBER,
        ...options,
      });
      if (!value) {
        throw new BadRequestError(
          `Argument "${value}" doesn't match required value for type "number"`,
        );
      }
      if (options.positive && (value as number) <= 0) {
        throw new BadRequestError(
          `Argument "${value}" doesn't match required value for type "positive"`,
        );
      }
      return true;
    case TYPE.OBJECT:
      return validate(value, { type: TYPE.OBJECT, required: true });
    case TYPE.STRING:
      validate(value, {
        type: TYPE.STRING,
      });
      if (!value) {
        throw new BadRequestError(
          `Argument "${value}" doesn't match required value for type "string"`,
        );
      }
      return true;
    default:
      throw TypeError(`Unsupported type, "${type}"`);
  }
};

//
//
// Convenience Functions
//

required.array = (value: unknown): boolean => required(value, Array);
required.boolean = (value: unknown): boolean => required(value, Boolean);
required.number = (value: unknown): boolean => required(value, Number);
required.object = (value: unknown): boolean => required(value, Object);
required.positive = (value: unknown): boolean =>
  required(value, Number, { positive: true });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
required.string = (value: unknown, _defaultValue = ""): boolean =>
  required(value, String);

export default required;
export type { RequiredFunction, RequiredOptions };
