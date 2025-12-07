/**
 * Resolves a value or function to its final value
 * @param {*} valueOrFunction - The value or function to resolve
 * @returns {Promise<*>} The resolved value
 */
const resolveValue = async <T>(
  valueOrFunction: T | (() => T) | (() => Promise<T>),
): Promise<T> => {
  if (typeof valueOrFunction !== "function") {
    return valueOrFunction as T;
  }

  const result = (valueOrFunction as () => T | Promise<T>)();

  if (result instanceof Promise) {
    return await result;
  }

  return result;
};

export default resolveValue;
