import { TYPE } from "./constants.js";

//
//
// Main
//

const force = (value, type, options) => {
  // * Backwards compatibility when options was a single string
  if (typeof options !== "object") {
    if (options === undefined) {
      options = { key: "" };
    } else if (typeof options === "string") {
      options = { key: options };
    } else {
      options = { key: String(options) };
    }
  }

  let { key, maximum, minimum, nan } = options;
  if (nan === undefined) nan = false;

  switch (type) {
    case TYPE.ARRAY:
      if (!Array.isArray(value)) return [value];
      return value;
    case TYPE.BOOLEAN:
      if (typeof value === "string") {
        value = value.toLowerCase();
        if (
          value === "" ||
          value === "0" ||
          value === "f" ||
          value === "false" ||
          value === "n" ||
          value === "no"
        ) {
          return false;
        } else {
          return true;
        }
      }
      return Boolean(value);
    case TYPE.NUMBER:
      // eslint-disable-next-line no-case-declarations
      let number = Number(value);
      if (isNaN(number)) {
        if (nan) return number;
        return 0;
      }
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        return number;
      }
      if (minimum !== undefined && number < minimum) {
        number = minimum;
      }
      if (maximum !== undefined && number > maximum) {
        number = maximum;
      }
      return number;
    case TYPE.OBJECT:
      if (!key) key = "value";
      // If it is a string, try parsing as JSON but catch errors
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          // Do nothing
        }
      }
      if (typeof value !== "object") return { [key]: value };
      return value;
    case TYPE.STRING:
      if (value === null) return "null";
      if (value === undefined) return String(key);
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    default:
      throw TypeError(`Unsupported type, "${type}"`);
  }
};

//
//
// Convenience Functions
//

force.array = (value) => force(value, Array);
force.boolean = (value) => force(value, Boolean);
force.number = (value) => force(value, Number);
force.object = (value, key = "value") => force(value, Object, key);
force.positive = (value) => force(value, Number, { minimum: 0 });
force.string = (value, defaultValue = "") => force(value, String, defaultValue);

//
//
// Export
//

export default force;
