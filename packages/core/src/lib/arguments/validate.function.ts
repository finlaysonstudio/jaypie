import { BadRequestError, ConfigurationError } from "@jaypie/errors";
import { isClass } from "@jaypie/kit";

import { log } from "../../core.js";
import { TYPE, ValidationType } from "./constants.js";

const libLog = log.lib({ lib: "@jaypie/core" });

//
//
// Types
//

interface ValidateOptions {
  type?: ValidationType;
  falsy?: boolean;
  required?: boolean;
  throws?: boolean;
}

interface ValidateFunction {
  (argument: unknown, options?: ValidateOptions): boolean;
  array: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  boolean: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  class: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  function: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  null: (argument: unknown, options?: Omit<ValidateOptions, "type">) => boolean;
  number: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  object: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  string: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  undefined: (
    argument: unknown,
    options?: Omit<ValidateOptions, "type">,
  ) => boolean;
  optional: {
    array: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    boolean: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    class: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    function: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    null: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    number: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    object: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
    string: (
      argument: unknown,
      options?: Omit<ValidateOptions, "type" | "required">,
    ) => boolean;
  };
}

//
//
// Main
//

const validate: ValidateFunction = (
  argument: unknown,
  {
    type = TYPE.ANY,
    falsy = true,
    required = true,
    throws = true,
  }: ValidateOptions = {},
): boolean => {
  libLog.warn(
    "[deprecated] validate() is deprecated and will be removed in a future version",
  );
  //
  //
  // Setup
  //
  const isUndefined = argument === undefined;
  let matchesType = false;
  let valid = false;

  //
  //
  // Check Type
  //
  switch (type) {
    case TYPE.ANY:
      matchesType = true;
      break;
    case TYPE.ARRAY:
      if (Array.isArray(argument)) matchesType = true;
      break;
    case TYPE.BOOLEAN:
      matchesType = typeof argument === "boolean";
      break;
    case TYPE.CLASS:
      matchesType = isClass(argument);
      break;
    case TYPE.FUNCTION:
      matchesType = typeof argument === "function" && !isClass(argument);
      break;
    case TYPE.NUMBER:
      matchesType = typeof argument === "number";
      break;
    case TYPE.NULL:
      matchesType = argument === null;
      break;
    case TYPE.OBJECT:
      matchesType = typeof argument === "object";
      matchesType = matchesType && argument !== null;
      matchesType = matchesType && !Array.isArray(argument);
      break;
    case TYPE.STRING:
      matchesType = typeof argument === "string";
      break;
    case TYPE.UNDEFINED:
      matchesType = argument === undefined;
      break;

    default:
      throw new ConfigurationError(`Unknown validate type "${type}"`);
  }

  //
  //
  // Determine Valid
  //
  valid = matchesType;
  // If it is required
  if (required) {
    // As long as the type isn't undefined
    if (type !== TYPE.UNDEFINED) {
      valid = valid && !isUndefined;

      // Reject falsy numbers and strings by default
      if (type === TYPE.NUMBER || type === TYPE.STRING) {
        if (!falsy) {
          if (!argument) valid = false;
        }
      }
    }
    // Otherwise (not required) allow undefined
  } else if (argument === undefined) valid = true;

  // Don't allow NaN as a valid number
  if (type === TYPE.NUMBER) {
    valid = valid && !Number.isNaN(argument);
  }

  //
  //
  // Throw?
  //
  if (!valid && throws) {
    switch (type) {
      case TYPE.ANY:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "any"`,
        );
      case TYPE.ARRAY:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "array"`,
        );
      case TYPE.CLASS:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "class"`,
        );
      case TYPE.FUNCTION:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "function"`,
        );
      case TYPE.NUMBER:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "number"`,
        );
      case TYPE.NULL:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "null"`,
        );
      case TYPE.OBJECT:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "object"`,
        );
      case TYPE.STRING:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "string"`,
        );
      case TYPE.UNDEFINED:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "undefined"`,
        );

      default:
        throw new BadRequestError(
          `Argument "${argument}" doesn't match type "${type}"`,
        );
    }
  }

  //
  //
  // Return
  //
  return valid;
};

//
//
// Convenience functions
//

validate.array = (argument, options) =>
  validate(argument, { type: TYPE.ARRAY, ...options });
validate.boolean = (argument, options) =>
  validate(argument, { type: TYPE.BOOLEAN, ...options });
validate.class = (argument, options) =>
  validate(argument, { type: TYPE.CLASS, ...options });
validate.function = (argument, options) =>
  validate(argument, { type: TYPE.FUNCTION, ...options });
validate.null = (argument, options) =>
  validate(argument, { type: TYPE.NULL, ...options });
validate.number = (argument, options) =>
  validate(argument, { type: TYPE.NUMBER, ...options });
validate.object = (argument, options) =>
  validate(argument, { type: TYPE.OBJECT, ...options });
validate.string = (argument, options) =>
  validate(argument, { type: TYPE.STRING, ...options });
validate.undefined = (argument, options) =>
  validate(argument, { type: TYPE.UNDEFINED, ...options });

validate.optional = {
  array: (argument, options) =>
    validate(argument, { type: TYPE.ARRAY, required: false, ...options }),
  boolean: (argument, options) =>
    validate(argument, { type: TYPE.BOOLEAN, required: false, ...options }),
  class: (argument, options) =>
    validate(argument, { type: TYPE.CLASS, required: false, ...options }),
  function: (argument, options) =>
    validate(argument, { type: TYPE.FUNCTION, required: false, ...options }),
  null: (argument, options) =>
    validate(argument, { type: TYPE.NULL, required: false, ...options }),
  number: (argument, options) =>
    validate(argument, { type: TYPE.NUMBER, required: false, ...options }),
  object: (argument, options) =>
    validate(argument, { type: TYPE.OBJECT, required: false, ...options }),
  string: (argument, options) =>
    validate(argument, { type: TYPE.STRING, required: false, ...options }),
};

export default validate;
export type { ValidateFunction, ValidateOptions };
