//
//
// Main
//

const objectToKeyValueArrayPipeline = (valueSet) => {
  if (typeof valueSet !== "object" || valueSet === null) {
    return valueSet;
  }
  if (Array.isArray(valueSet)) {
    return valueSet;
  }
  // Convert object to key-value array strings ["key:value"]
  const results = [...Object.entries(valueSet)].map(([key, value]) => {
    return typeof value === "object"
      ? `${key}:${JSON.stringify(value)}`
      : `${key}:${value}`;
  });
  return results;
};

//
//
// Export
//

export default objectToKeyValueArrayPipeline;
