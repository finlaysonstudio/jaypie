import getObjectKeyCaseInsensitive from "./getObjectKeyCaseInsensitive.js";
import validate, { force } from "../arguments/index.js";

const LOCAL_ENV = "local";

//
//
// Main
//

/**
 * return process.env.${KEY} || ENV_${ENV}_${KEY}
 * @param {Object} options - Options.
 * @param {string} options.env - Environment key.
 * @param {boolean} options.hints - Log hints that encourage best practices
 * @returns {string} MongoDB URI.
 * @example const mongodbUri = envsKey("MONGODB_URI", { env: "SANDBOX", hints: true }); // returns MONGODB_URI || ENV_SANDBOX_MONGODB_URI
 */
const envsKey = (
  key,
  { env = process.env.PROJECT_ENV || process.env.DEFAULT_ENV } = {},
) => {
  // Validate
  env = force.string(env);
  validate.string(key, { falsy: false });

  if (!env) {
    env = LOCAL_ENV;
    // console.warn(`No environment key provided. Pass an environment key or set DEFAULT_ENV. Using ${String(`ENV_${env}_${key}`).toUpperCase()} as default environment key`);
  }

  // Setup
  const envKey = String(`ENV_${env}_${key}`).toUpperCase();
  const envValue = getObjectKeyCaseInsensitive(process.env, envKey);
  const overrideKey = getObjectKeyCaseInsensitive(process.env, key);

  // Return ${key} first, but hint about ${envKey}
  if (overrideKey) {
    // console.log(`Using ${key} from environment.`);
    if (envValue) {
      // console.warn(`Overriding ${envKey} with ${key}. Remove ${key} to prefer ${envKey}.`);
    } else {
      // console.log("MONGODB_URI overrides environment-specific values. Set ENV_SANDBOX_MONGODB_URI to connect to sandbox by default and pass --env KEY to use the ENV_${KEY}_MONGODB_URI");
    }
    return overrideKey;
  }

  if (envValue) {
    // console.log(`Using ${envKey} from environment.`);
    return envValue;
  }
  // console.log(`${key} not found in environment`);
  return false;
};

//
//
// Export
//

export default envsKey;
