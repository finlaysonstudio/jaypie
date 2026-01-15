// Service for @jaypie/fabric

import { BadRequestError } from "@jaypie/errors";

import { FABRIC_VERSION } from "./constants.js";
import { fabric } from "./convert.js";
import type {
  ConversionType,
  InputFieldDefinition,
  Service,
  ServiceConfig,
  ServiceContext,
  ValidateFunction,
} from "./types.js";

/**
 * Check if a single-element array is a typed array type constructor.
 */
function isTypedArrayConstructor(element: unknown): boolean {
  return (
    element === Boolean ||
    element === Number ||
    element === String ||
    element === Object ||
    element === "boolean" ||
    element === "number" ||
    element === "string" ||
    element === "object" ||
    element === "" ||
    (typeof element === "object" &&
      element !== null &&
      !(element instanceof RegExp) &&
      Object.keys(element as Record<string, unknown>).length === 0)
  );
}

/**
 * Check if a type is a validated string type (array of string literals and/or RegExp).
 * Distinguishes from typed arrays like [String], [Number], etc.
 */
function isValidatedStringType(
  type: ConversionType,
): type is Array<string | RegExp> {
  if (!Array.isArray(type)) {
    return false;
  }

  // Empty array is untyped array, not validated string
  if (type.length === 0) {
    return false;
  }

  // Single-element arrays with type constructors are typed arrays
  if (type.length === 1 && isTypedArrayConstructor(type[0])) {
    return false;
  }

  // Check that all elements are strings or RegExp
  return type.every(
    (item) => typeof item === "string" || item instanceof RegExp,
  );
}

/**
 * Check if a type is a validated number type (array of number literals).
 * Distinguishes from typed arrays like [Number], etc.
 */
function isValidatedNumberType(type: ConversionType): type is Array<number> {
  if (!Array.isArray(type)) {
    return false;
  }

  // Empty array is untyped array, not validated number
  if (type.length === 0) {
    return false;
  }

  // Single-element arrays with type constructors are typed arrays
  if (type.length === 1 && isTypedArrayConstructor(type[0])) {
    return false;
  }

  // Check that all elements are numbers
  return type.every((item) => typeof item === "number");
}

/**
 * Parse input string as JSON if it's a string
 */
function parseInput(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input === "string") {
    if (input === "") {
      return {};
    }
    try {
      const parsed = JSON.parse(input);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new BadRequestError("Input must be an object");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError("Invalid JSON input");
    }
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  throw new BadRequestError("Input must be an object or JSON string");
}

/**
 * Run validation on a value (supports async validators)
 */
async function runValidation(
  value: unknown,
  validate: ValidateFunction | RegExp | Array<unknown>,
  fieldName: string,
): Promise<void> {
  if (typeof validate === "function") {
    const result = await validate(value);
    if (result === false) {
      throw new BadRequestError(`Validation failed for field "${fieldName}"`);
    }
  } else if (validate instanceof RegExp) {
    if (typeof value !== "string" || !validate.test(value)) {
      throw new BadRequestError(`Validation failed for field "${fieldName}"`);
    }
  } else if (Array.isArray(validate)) {
    // Check if value matches any item in the array
    for (const item of validate) {
      if (item instanceof RegExp) {
        if (typeof value === "string" && item.test(value)) {
          return; // Match found
        }
      } else if (typeof item === "function") {
        try {
          const result = await (item as ValidateFunction)(value);
          if (result !== false) {
            return; // Match found
          }
        } catch {
          // Continue to next item
        }
      } else if (value === item) {
        return; // Scalar match found
      }
    }
    throw new BadRequestError(`Validation failed for field "${fieldName}"`);
  }
}

/**
 * Check if a field is required
 * A field is required unless it has a default OR required is explicitly false
 */
function isFieldRequired(definition: InputFieldDefinition): boolean {
  if (definition.required === false) {
    return false;
  }
  if (definition.default !== undefined) {
    return false;
  }
  return true;
}

/**
 * Process a single field through conversion and validation
 */
async function processField(
  fieldName: string,
  value: unknown,
  definition: InputFieldDefinition,
): Promise<unknown> {
  // Apply default if value is undefined
  let processedValue = value;
  if (processedValue === undefined && definition.default !== undefined) {
    processedValue = definition.default;
  }

  // Determine actual type and validation
  let actualType: ConversionType = definition.type;
  let validation = definition.validate;

  // Handle bare RegExp shorthand: /regex/
  if (definition.type instanceof RegExp) {
    actualType = String;
    validation = definition.type; // The RegExp becomes the validation
  }
  // Handle validated string shorthand: ["value1", "value2"] or [/regex/]
  else if (isValidatedStringType(definition.type)) {
    actualType = String;
    validation = definition.type; // The array becomes the validation
  }
  // Handle validated number shorthand: [1, 2, 3]
  else if (isValidatedNumberType(definition.type)) {
    actualType = Number;
    validation = definition.type; // The array becomes the validation
  }

  // Fabric to target type
  const convertedValue = fabric(processedValue, actualType);

  // Check if required field is missing
  if (convertedValue === undefined && isFieldRequired(definition)) {
    throw new BadRequestError(`Missing required field "${fieldName}"`);
  }

  // Run validation if provided
  if (validation !== undefined && convertedValue !== undefined) {
    await runValidation(convertedValue, validation, fieldName);
  }

  return convertedValue;
}

/**
 * Fabric a service function
 *
 * Service builds a function that initiates a "controller" step that:
 * - Parses the input if it is a string to object
 * - Fabrics each input field to its type
 * - Calls the validation function or regular expression or checks the array
 * - Calls the service function and returns the response
 *
 * The returned function has config properties for introspection.
 */
export function fabricService<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
>(config: ServiceConfig<TInput, TOutput>): Service<TInput, TOutput> {
  const { input: inputDefinitions, service } = config;

  const handler = async (
    rawInput?: Partial<TInput> | string,
    context?: ServiceContext,
  ): Promise<TOutput> => {
    // Parse input (handles string JSON)
    const parsedInput = parseInput(rawInput);

    // If no input definitions, pass through to service or return parsed input
    if (!inputDefinitions) {
      if (service) {
        return service(parsedInput as TInput, context);
      }
      return parsedInput as TOutput;
    }

    // Process all fields in parallel
    const entries = Object.entries(inputDefinitions);
    const processedValues = await Promise.all(
      entries.map(([fieldName, definition]) =>
        processField(fieldName, parsedInput[fieldName], definition),
      ),
    );

    // Build processed input object
    const processedInput: Record<string, unknown> = {};
    entries.forEach(([fieldName], index) => {
      processedInput[fieldName] = processedValues[index];
    });

    // Return processed input if no service, otherwise call service
    if (service) {
      return service(processedInput as TInput, context);
    }
    return processedInput as TOutput;
  };

  // Attach config properties directly to handler for flat access
  const typedHandler = handler as Service<TInput, TOutput>;
  typedHandler.$fabric = FABRIC_VERSION;
  if (config.alias !== undefined) typedHandler.alias = config.alias;
  if (config.description !== undefined)
    typedHandler.description = config.description;
  if (config.input !== undefined) typedHandler.input = config.input;
  if (config.service !== undefined) typedHandler.service = config.service;

  return typedHandler;
}
