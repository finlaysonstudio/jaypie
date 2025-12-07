const safeParseFloat = (value: unknown): number => {
  if (typeof value === "string") {
    return Number.isNaN(parseFloat(value)) ? 0 : parseFloat(value);
  }
  if (typeof value === "number") {
    return value;
  }
  return 0;
};

export default safeParseFloat;
