import { force } from "@jaypie/kit";

//
//
// Main
//

const forceVar = (
  key?: string | Record<string, unknown>,
  value?: unknown,
): Record<string, unknown> => {
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
  const stringKey = force.string(key);
  if (typeof value === "undefined") {
    return { [stringKey]: "" };
  } else {
    return { [stringKey]: value };
  }
};

//
//
// Export
//

export default forceVar;
