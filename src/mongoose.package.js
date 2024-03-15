import { ConfigurationError, moduleLogger, PROJECT } from "@jaypie/core";

//
//
// Helper Functions
//

let _importedMongoose;
async function importMongoose() {
  const log = moduleLogger.with({ lib: PROJECT.SPONSOR.JAYPIE });
  if (!_importedMongoose) {
    try {
      // eslint-disable-next-line import/no-unresolved
      _importedMongoose = await import("@jaypie/mongoose");
    } catch (error) {
      log.error("[jaypie] @jaypie/mongoose could not be imported");
      if (process.env.NODE_ENV === "test") {
        if (!_importedMongoose) {
          // eslint-disable-next-line no-console
          console.warn(
            "Caught error importing @jaypie/mongoose -- Is it installed?",
          );
        }
        // eslint-disable-next-line no-console
        console.error(error);
      }
      throw new ConfigurationError();
    }
  }
  return _importedMongoose;
}

//
//
// Main
//

function init() {
  return {
    connectFromSecretEnv: async () => {
      const mongoose = await importMongoose();
      return await mongoose.connectFromSecretEnv();
    },
    disconnect: async () => {
      const mongoose = await importMongoose();
      return await mongoose.disconnect();
    },
  };
}

//
//
// Export
//

export const { connectFromSecretEnv, disconnect } = init();
