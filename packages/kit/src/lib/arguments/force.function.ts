import { TYPE, ValidationType } from "./constants.js";

//
//
// Types
//

interface ForceOptions {
  key?: string;
  maximum?: number;
  minimum?: number;
  nan?: boolean;
}

interface ForceFunction {
  <T>(value: unknown, type: ValidationType, options?: ForceOptions | string): T;
  array: <T = unknown>(value: unknown) => T[];
  boolean: (value: unknown) => boolean;
  number: (value: unknown) => number;
  object: <T = Record<string, unknown>>(value: unknown, key?: string) => T;
  positive: (value: unknown) => number;
  string: (value: unknown, defaultValue?: string) => string;
}

//
//
// Main
//

const force = (<T>(
  value: unknown,
  type: ValidationType,
  options?: ForceOptions | string,
): T => {
  // * Backwards compatibility when options was a single string
  let opts: ForceOptions;
  if (typeof options !== "object") {
    if (options === undefined) {
      opts = { key: "" };
    } else if (typeof options === "string") {
      opts = { key: options };
    } else {
      opts = { key: String(options) };
    }
  } else {
    opts = options;
  }

  let { key, maximum, minimum, nan } = opts;
  if (nan === undefined) nan = false;

  switch (type) {
    case TYPE.ARRAY:
      if (!Array.isArray(value)) return [value] as T;
      return value as T;
    case TYPE.BOOLEAN:
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase();
        if (
          lowerValue === "" ||
          lowerValue === "0" ||
          lowerValue === "f" ||
          lowerValue === "false" ||
          lowerValue === "n" ||
          lowerValue === "no"
        ) {
          return false as T;
        } else {
          return true as T;
        }
      }
      return Boolean(value) as T;
    case TYPE.NUMBER: {
      let number = Number(value);
      if (isNaN(number)) {
        if (nan) return number as T;
        return 0 as T;
      }
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        return number as T;
      }
      if (minimum !== undefined && number < minimum) {
        number = minimum;
      }
      if (maximum !== undefined && number > maximum) {
        number = maximum;
      }
      return number as T;
    }
    case TYPE.OBJECT:
      if (!key) key = "value";
      // If it is a string, try parsing as JSON but catch errors
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as T;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          // Do nothing
        }
      }
      if (typeof value !== "object") return { [key]: value } as T;
      return value as T;
    case TYPE.STRING:
      if (value === null) return "null" as T;
      if (value === undefined) return String(key) as T;
      if (typeof value === "object") return JSON.stringify(value) as T;
      return String(value) as T;
    default:
      throw TypeError(`Unsupported type, "${type}"`);
  }
}) as ForceFunction;

//
//
// Convenience Functions
//

force.array = <T = unknown>(value: unknown): T[] => force(value, Array);
force.boolean = (value: unknown): boolean => force(value, Boolean);
force.number = (value: unknown): number => force(value, Number);
force.object = <T = Record<string, unknown>>(
  value: unknown,
  key = "value",
): T => force(value, Object, key);
force.positive = (value: unknown): number =>
  force(value, Number, { minimum: 0 });
force.string = (value: unknown, defaultValue = ""): string =>
  force(value, String, defaultValue);

export default force;
export type { ForceFunction, ForceOptions };
