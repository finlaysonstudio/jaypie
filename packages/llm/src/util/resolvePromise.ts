/**
 * Resolves a value if it is a Promise, otherwise returns the value itself.
 *
 * @param value - Any value or Promise to resolve
 * @returns The resolved value
 */
export async function resolvePromise<T>(value: T | Promise<T>): Promise<T> {
  if (value instanceof Promise) {
    return await value;
  }
  return value;
}
