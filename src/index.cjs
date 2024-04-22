import { ConfigurationError, JAYPIE, log } from "@jaypie/core";

//
//
// Helper Functions
//

const _importedModule = {};
function dynamicImport(module) {
  if (!_importedModule[module]) {
    try {
      _importedModule[module] = require(module);
    } catch (error) {
      if (process.env.NODE_ENV === "test") {
        if (!_importedModule[module]) {
          // eslint-disable-next-line no-console
          console.warn(
            `[jaypie] Caught error requiring ${module} -- Is it installed?`,
          );
        }
      }
      throw new ConfigurationError();
    }
  }
  return _importedModule[module];
}

function dynamicExport({
  functions = ["default"],
  moduleImport,
  vars = [],
} = {}) {
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
  // Process
  try {
    // Attempt to import the module
    return dynamicImport(moduleImport);
  } catch (error) {
    log
      .lib({ lib: JAYPIE.LIB.JAYPIE })
      .trace(`[jaypie] ${moduleImport} could not be imported; continuing`);
  }
  // Return
  const result = {};
  functions.forEach((func) => {
    result[func] = () => {
      throw new ConfigurationError(`${moduleImport}.${func} is not available`);
    };
  });
  vars.forEach((variable) => {
    result[variable] = null;
  });
  return result;
}

//
//
// Export
//

module.exports = {
  ...dynamicExport({
    functions: ["getMessages", "getSecret", "sendBatchMessages", "sendMessage"],
    moduleImport: JAYPIE.LIB.AWS,
  }),
  ...dynamicExport({
    functions: ["lambdaHandler"],
    moduleImport: JAYPIE.LIB.LAMBDA,
  }),
  ...dynamicExport({
    functions: ["connectFromSecretEnv", "disconnect"],
    moduleImport: JAYPIE.LIB.MONGOOSE,
  }),
};
