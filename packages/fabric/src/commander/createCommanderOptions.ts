// Create Commander.js options from service config

import { Option } from "commander";

import type { ConversionType, InputFieldDefinition } from "../types.js";
import type {
  CommanderOptionOverride,
  CreateCommanderOptionsConfig,
  CreateCommanderOptionsResult,
} from "./types.js";

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Check if a type is a typed array (e.g., [String], [Number])
 */
function isTypedArrayType(type: ConversionType): boolean {
  if (!Array.isArray(type)) {
    return false;
  }
  if (type.length === 0) {
    return true; // [] is untyped array
  }
  if (type.length !== 1) {
    return false;
  }
  const element = type[0];
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
 * Check if a type represents a boolean
 */
function isBooleanType(type: ConversionType): boolean {
  return type === Boolean || type === "boolean";
}

/**
 * Check if a type is variadic (array-like)
 */
function isVariadicType(type: ConversionType): boolean {
  if (type === Array || type === "array") {
    return true;
  }
  return isTypedArrayType(type);
}

/**
 * Get default description for a field
 */
function getDescription(
  fieldName: string,
  definition: InputFieldDefinition,
  override?: CommanderOptionOverride,
): string {
  if (override?.description) {
    return override.description;
  }
  if (definition.description) {
    return definition.description;
  }
  return fieldName;
}

/**
 * Build the flags string for an option
 */
function buildFlags(
  fieldName: string,
  definition: InputFieldDefinition,
  override?: CommanderOptionOverride,
): string {
  if (override?.flags) {
    return override.flags;
  }

  // Priority: override.long > definition.flag > toKebabCase(fieldName)
  const long = override?.long ?? definition.flag ?? toKebabCase(fieldName);
  // Priority: override.short > definition.letter
  const short = override?.short ?? definition.letter;
  const isBoolean = isBooleanType(definition.type);
  const isVariadic = isVariadicType(definition.type);
  const isRequired =
    definition.required !== false && definition.default === undefined;

  let flags = "";
  if (short) {
    flags += `-${short}, `;
  }
  flags += `--${long}`;

  if (!isBoolean) {
    if (isVariadic) {
      // Variadic: can take multiple values
      if (isRequired) {
        flags += ` <${fieldName}...>`;
      } else {
        flags += ` [${fieldName}...]`;
      }
    } else {
      // Scalar value
      if (isRequired) {
        flags += ` <${fieldName}>`;
      } else {
        flags += ` [${fieldName}]`;
      }
    }
  }

  return flags;
}

/**
 * Create a Commander Option from a field definition
 */
function createOption(
  fieldName: string,
  definition: InputFieldDefinition,
  override?: CommanderOptionOverride,
): Option {
  const flags = buildFlags(fieldName, definition, override);
  const description = getDescription(fieldName, definition, override);

  const option = new Option(flags, description);

  // Set default value if provided
  if (definition.default !== undefined) {
    option.default(definition.default);
  }

  // Hide from help if specified
  if (override?.hidden) {
    option.hideHelp();
  }

  return option;
}

/**
 * Create Commander.js Option objects from a service config
 *
 * @param input - The input field definitions from a service config
 * @param config - Optional configuration for excluding fields or overriding options
 * @returns An object containing an array of Commander Option objects
 *
 * @example
 * ```typescript
 * const handler = createService({
 *   input: {
 *     name: { type: String, description: "User name" },
 *     age: { type: Number, default: 25 },
 *     verbose: { type: Boolean },
 *   },
 *   service: (input) => input,
 * });
 *
 * const { options } = createCommanderOptions(handler.input);
 * options.forEach(opt => command.addOption(opt));
 * ```
 */
export function createCommanderOptions(
  input?: Record<string, InputFieldDefinition>,
  config: CreateCommanderOptionsConfig = {},
): CreateCommanderOptionsResult {
  if (!input) {
    return { options: [] };
  }

  const { exclude = [], overrides = {} } = config;
  const options: Option[] = [];

  for (const [fieldName, definition] of Object.entries(input)) {
    // Skip excluded fields
    if (exclude.includes(fieldName)) {
      continue;
    }

    const override = overrides[fieldName];
    const option = createOption(fieldName, definition, override);
    options.push(option);

    // For boolean fields, also create a --no-<flag> option for negation
    // Commander.js requires separate options for --flag and --no-flag
    if (isBooleanType(definition.type) && !override?.flags) {
      const long = override?.long ?? definition.flag ?? toKebabCase(fieldName);
      const negateOption = new Option(`--no-${long}`, `Disable ${fieldName}`);
      // Hide the negatable option from help to avoid clutter
      negateOption.hideHelp();
      options.push(negateOption);
    }
  }

  return { options };
}
