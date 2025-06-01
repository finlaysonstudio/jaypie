/**
 * Resolves a value or function to its final value
 * @param {*} valueOrFunction - The value or function to resolve
 * @returns {Promise<*>} The resolved value
 */
const resolveValue = async (valueOrFunction) => {
  if (typeof valueOrFunction !== "function") {
    return valueOrFunction;
  }

  const result = valueOrFunction();

  if (result instanceof Promise) {
    return await result;
  }

  return result;
};

export default resolveValue;
