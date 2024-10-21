import { ConfigurationError, JAYPIE, log } from "@jaypie/core";
import mongoose from "mongoose";

import connectFromSecretEnv from "./connectFromSecretEnv.function.js";

//
//
// Main
//

/**
 * **Jaypie Handler Lifecycle -**
 * Use the AWS Secret named `process.env.SECRET_MONGODB_URI` to connect to Mongoose.
 * Otherwise, use the `process.env.MONGODB_URI`
 * @returns {Promise<mongoose>} resolves to `this` mongoose instance
 * @throws {ConfigurationError} if key is not found in process.env
 */
const connect = async () => {
  if (!process || !process.env)
    throw new ConfigurationError(
      "No process.env available to the active runtime",
    );

  if (process.env.SECRET_MONGODB_URI) return connectFromSecretEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new ConfigurationError(
      "SECRET_MONGODB_URI and MONGODB_URI are both undefined",
    );
  log.lib({ lib: JAYPIE.LIB.MONGOOSE }).trace("[jaypie] Connecting to MongoDB");
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
};

//
//
// Export
//

export default connect;
