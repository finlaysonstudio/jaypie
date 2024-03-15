import { ConfigurationError, moduleLogger, PROJECT } from "@jaypie/core";

//
//
// Constants
//

//
//
// Helper Functions
//

//
//
// Main
//

const connectFromSecretEnv = async () => {
  const log = moduleLogger.with({ lib: PROJECT.SPONSOR.JAYPIE });
  let mongoose;
  try {
    // eslint-disable-next-line import/no-unresolved
    mongoose = await import("@jaypie/mongoose");
    return await mongoose.connectFromSecretEnv();
  } catch (error) {
    log.error("[jaypie] @jaypie/mongoose is not installed");
    if (process.env.NODE_ENV === "test") {
      if (!mongoose) {
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
};

const disconnect = async () => {
  //
};

//
//
// Export
//

export { connectFromSecretEnv, disconnect };
