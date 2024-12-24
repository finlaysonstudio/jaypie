/**
 * Checks if an error is a Jaypie error
 * @param error The error to check
 * @returns true if the error is a Jaypie error
 */
export function isJaypieError(error: unknown): boolean {
  const result =
    error &&
    ((error as any).isJaypieError === true ||
      (error as any).isProjectError === true) &&
    typeof (error as any).json === "function";
  // TODO: and calling error.json() returns a JSON:API error object
  // - Which implies calling json() never has a side effect. This sounds correct and is thus far true
  if (result) {
    return true;
  }
  return false;
}
