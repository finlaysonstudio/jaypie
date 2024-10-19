import { BadRequestError, ConfigurationError } from "../errors.lib.js";

import { TYPE } from "./constants.js";
import isClass from "./isClass.function.js";

//
//
// Main
//

const validate = (
  argument,
  { type = TYPE.ANY, falsy = true, required = true, throws = true } = {},
) => {
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
      throw ConfigurationError(`Unknown validate type "${type}"`);
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
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "any"`,
        );
      case TYPE.ARRAY:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "array"`,
        );
      case TYPE.CLASS:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "class"`,
        );
      case TYPE.FUNCTION:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "function"`,
        );
      case TYPE.NUMBER:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "number"`,
        );
      case TYPE.NULL:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "null"`,
        );
      case TYPE.OBJECT:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "object"`,
        );
      case TYPE.STRING:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "string"`,
        );
      case TYPE.UNDEFINED:
        throw BadRequestError(
          `Argument "${argument}" doesn't match type "undefined"`,
        );

      default:
        throw BadRequestError(
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

//
//
// Export
//

export default validate;
