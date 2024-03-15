import { ConfigurationError, moduleLogger, PROJECT } from "@jaypie/core";

//
//
// Helper Functions
//

let _importedModule;
async function dynamicImport(module) {
  const log = moduleLogger.with({ lib: PROJECT.SPONSOR.JAYPIE });
  if (!_importedModule) {
    try {
      // eslint-disable-next-line import/no-unresolved
      _importedModule = await import(module);
    } catch (error) {
      log.error(`[jaypie] ${module} could not be imported`);
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

export default ({ exports = ["default"], moduleImport } = {}) => {
  // Validate
  if (Array.isArray(exports) && !exports.length) {
    throw new ConfigurationError();
  }
  if (!moduleImport || typeof moduleImport !== "string") {
    throw new ConfigurationError();
  }
  // Setup
  return exports.reduce((acc, key) => {
    acc[key] = async () => {
      const imported = await dynamicImport(moduleImport);
      return await imported[key]();
    };
    return acc;
  }, {});
};
