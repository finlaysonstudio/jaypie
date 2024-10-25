import { BadRequestError } from "../errors.lib.js";
import { TYPE } from "./constants.js";
import validate from "./validate.function.js";

//
//
// Main
//

const optional = (value, type, options = {}) => {
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
        if (value <= 0) {
          throw BadRequestError(
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

optional.array = value => optional(value, Array);
optional.boolean = value => optional(value, Boolean);
optional.number = value => optional(value, Number);
optional.object = value => optional(value, Object);
optional.positive = value => optional(value, Number, { positive: true });
optional.string = (value, defaultValue = "") =>
  optional(value, String, defaultValue);

//
//
// Export
//

export default optional;
