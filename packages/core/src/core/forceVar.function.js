import { force } from "../lib/arguments.lib.js";

//
//
// Main
//

const forceVar = (key, value) => {
  if (typeof key === "undefined") {
    return {};
  }
  if (typeof key === "object") {
    if (Object.keys(key).length === 1) {
      return key;
    } else {
      return { value: key };
    }
  }
  key = force.string(key);
  if (typeof value === "undefined") {
    return { [key]: "" };
  } else {
    return { [key]: value };
  }
};

//
//
// Export
//

export default forceVar;
