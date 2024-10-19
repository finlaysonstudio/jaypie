import formatAsJsonString from "./formatAsJsonString.js";

//
//
// Main
//

export default (...params) => {
  if (params.length === 0) return "";
  if (params.length === 1) {
    return formatAsJsonString(params[0]);
  }

  // If none of the params are objects, return a space-separated string
  const noObjects = params.reduce((previous, current) => {
    if (typeof current === "object" && current !== null) {
      return false;
    }
    return previous;
  }, true);

  if (noObjects) {
    const formatted = params.map(formatAsJsonString);
    return formatted.join(" ");
  }

  // Okay, something is an object, just formatAsJsonString
  return formatAsJsonString(params);
};
