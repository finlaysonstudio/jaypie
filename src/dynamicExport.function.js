import { ConfigurationError, JAYPIE, moduleLogger } from "@jaypie/core";

//
//
// Helper Functions
//

let _importedModule;
async function dynamicImport(module) {
  if (!_importedModule) {
    try {
      // eslint-disable-next-line import/no-unresolved
      _importedModule = await import(module);
    } catch (error) {
      moduleLogger
        .with({ lib: JAYPIE.LIB.JAYPIE })
        .error(`[jaypie] ${module} could not be imported`);
      if (process.env.NODE_ENV === "test") {
        if (!_importedModule) {
          // eslint-disable-next-line no-console
          console.warn(
            `[jaypie] Caught error importing ${module} -- Is it installed?`,
          );
        }
        // eslint-disable-next-line no-console
        console.error(error);
      }
      throw new ConfigurationError();
    }
  }
  return _importedModule;
}

//
//
// Main
//

export default async ({
  functions = ["default"],
  moduleImport,
  vars = [],
} = {}) => {
  // Validate
  if (!moduleImport || typeof moduleImport !== "string") {
    throw new ConfigurationError("`moduleImport` must be a string");
  }
  if (!Array.isArray(functions)) {
    throw new ConfigurationError("`functions` must be an array");
  }
  if (!Array.isArray(vars)) {
    throw new ConfigurationError("`vars` must be an array");
  }
  if (!functions.length && !vars.length) {
    throw new ConfigurationError(
      "Either `functions` or `vars` must be provided",
    );
  }
  // Setup
  const returning = {};
  // Process
  for (const key of functions) {
    returning[key] = async () => {
      const imported = await dynamicImport(moduleImport);
      return await imported[key]();
    };
  }
  // Return
  return returning;
};
