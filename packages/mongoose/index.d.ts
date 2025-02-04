import { mongoose } from "mongoose";

/**
 * **Jaypie Handler Lifecycle -**
 * Use the AWS Secret named `process.env.SECRET_MONGODB_URI` to connect to Mongoose.
 * Otherwise, use the `process.env.MONGODB_URI`
 */
export function connect(): Promise<typeof mongoose>;

/**
 * **Jaypie Handler Lifecycle -**
 * Use the AWS Secret named `process.env.SECRET_MONGODB_URI` to connect to Mongoose.
 * The `process.env[key]` should be the name of the AWS Secret (e.g., `"MongoConnectionString37D5BF-XUCja0vKbFwa"`)
 * The secret should contain the MongoDB connection URI.
 */
export function connectFromSecretEnv(): Promise<typeof mongoose>;

/**
 * **Jaypie Handler Lifecycle -**
 * Disconnects from MongoDB; Jaypie wrap of `mongoose.disconnect()`
 */
export function disconnect(): Promise<void>;

export { mongoose };
