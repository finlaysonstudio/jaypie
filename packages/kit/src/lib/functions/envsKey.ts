import getObjectKeyCaseInsensitive from "./getObjectKeyCaseInsensitive.js";
import { force } from "../arguments/index.js";

const LOCAL_ENV = "local";

interface EnvsKeyOptions {
  env?: string;
}

/**
 * return process.env.${KEY} || ENV_${ENV}_${KEY}
 * @param {string} key - The environment key to look up.
 * @param {Object} options - Options.
 * @param {string} options.env - Environment key.
 * @returns {string | false} The environment value or false if not found.
 * @example const mongodbUri = envsKey("MONGODB_URI", { env: "SANDBOX" }); // returns MONGODB_URI || ENV_SANDBOX_MONGODB_URI
 */
const envsKey = (
  key: string,
  {
    env = process.env.PROJECT_ENV || process.env.DEFAULT_ENV,
  }: EnvsKeyOptions = {},
): string | false => {
  // Validate
  let envValue = force.string(env);
  if (typeof key !== "string" || key === "") {
    throw new Error("key must be a non-empty string");
  }

  if (!envValue) {
    envValue = LOCAL_ENV;
  }

  // Setup
  const envKey = String(`ENV_${envValue}_${key}`).toUpperCase();
  const envKeyValue = getObjectKeyCaseInsensitive(
    process.env as Record<string, string>,
    envKey,
  ) as string | undefined;
  const overrideKey = getObjectKeyCaseInsensitive(
    process.env as Record<string, string>,
    key,
  ) as string | undefined;

  // Return ${key} first, but hint about ${envKey}
  if (overrideKey) {
    return overrideKey;
  }

  if (envKeyValue) {
    return envKeyValue;
  }

  return false;
};

export default envsKey;
