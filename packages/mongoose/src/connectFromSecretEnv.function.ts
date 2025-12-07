import { getSecret } from "@jaypie/aws";
import { ConfigurationError, JAYPIE, log } from "@jaypie/core";

import mongoose, { Mongoose } from "mongoose";

//
//
// Main
//

/**
 * **Jaypie Handler Lifecycle -**
 * Use the AWS Secret named `process.env.SECRET_MONGODB_URI` to connect to Mongoose.
 * The `process.env[key]` should be the name of the AWS Secret (e.g., `"MongoConnectionString37D5BF-XUCja0vKbFwa"`)
 * The secret should contain the MongoDB connection URI.
 * @returns {Promise<Mongoose>} resolves to `this` mongoose instance
 * @throws {ConfigurationError} if key is not found in process.env
 */
const connectFromSecretEnv = async (): Promise<Mongoose> => {
  if (!process || !process.env)
    throw new ConfigurationError(
      "No process.env available to the active runtime",
    );

  const mongoConnectionString = process.env.SECRET_MONGODB_URI;
  if (!mongoConnectionString) {
    throw new ConfigurationError(
      "No SECRET_MONGODB_URI available in process.env",
    );
  }
  const uri = await getSecret(mongoConnectionString);
  if (!uri) throw new ConfigurationError("MONGODB_URI is undefined");
  // Let connect() throw errors if there are other problems. As far as the app is concerned the game is over
  log.lib({ lib: JAYPIE.LIB.MONGOOSE }).trace("[jaypie] Connecting to MongoDB");
  // https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.connect()
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
};

//
//
// Export
//

export default connectFromSecretEnv;
