/**
 * Environment value type for the new array syntax
 * - string: key to lookup in process.env
 * - object: key-value pairs to include directly
 */
export type EnvironmentArrayItem = string | { [key: string]: string };

/**
 * Environment type that supports both legacy object syntax and new array syntax
 */
export type EnvironmentInput =
  | { [key: string]: string }
  | EnvironmentArrayItem[];

/**
 * Resolves environment input to a plain object.
 *
 * When environment is an object (legacy syntax), returns it as-is.
 * When environment is an array:
 *   - Strings are treated as keys to lookup in process.env
 *   - Objects have their key-value pairs merged in
 *
 * @example
 * // Legacy object syntax
 * resolveEnvironment({ FOO: "bar" })
 * // => { FOO: "bar" }
 *
 * @example
 * // Array syntax with process.env lookup
 * // Given process.env.MY_VAR = "hello"
 * resolveEnvironment(["MY_VAR"])
 * // => { MY_VAR: "hello" }
 *
 * @example
 * // Array syntax with objects
 * resolveEnvironment([{ FOO: "bar", BAZ: "qux" }])
 * // => { FOO: "bar", BAZ: "qux" }
 *
 * @example
 * // Mixed array syntax
 * // Given process.env.MY_VAR = "hello"
 * resolveEnvironment(["MY_VAR", { FOO: "bar" }])
 * // => { MY_VAR: "hello", FOO: "bar" }
 */
export function resolveEnvironment(
  environment?: EnvironmentInput,
  env: Record<string, string | undefined> = process.env,
): { [key: string]: string } {
  if (!environment) {
    return {};
  }

  // Legacy object syntax - return as-is
  if (!Array.isArray(environment)) {
    return environment;
  }

  // Array syntax - process each item
  return environment.reduce<{ [key: string]: string }>((acc, item) => {
    if (typeof item === "string") {
      // String: lookup in process.env
      const value = env[item];
      if (value !== undefined) {
        return {
          ...acc,
          [item]: value,
        };
      }
      // Skip if not found in process.env
      return acc;
    }

    // Object: merge key-value pairs
    return {
      ...acc,
      ...item,
    };
  }, {});
}
