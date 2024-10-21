import { JAYPIE, log } from "@jaypie/core";

import connect from "./connect.function.js";
import connectFromSecretEnv from "./connectFromSecretEnv.function.js";

//
//
// Export
//

export { connect, connectFromSecretEnv };

//
//
// Mongoose Pass-through
//

import mongoose from "mongoose";
export { mongoose };

//
//
// Functions
//

/**
 * **Jaypie Handler Lifecycle -**
 * Disconnects from MongoDB; Jaypie wrap of `mongoose.disconnect()`
 * @returns {Promise<void>}
 */
export const disconnect = async () => {
  log
    .lib({ lib: JAYPIE.LIB.MONGOOSE })
    .trace("[jaypie] Disconnecting from MongoDB");
  return await mongoose.disconnect();
};
