import {
  DATADOG_API_KEY_ENV,
  findDatadogKeySource,
} from "./resolveDatadogKeys.function.js";

//
//
// Function
//

/**
 * True when any variable that can supply the Datadog API key is set.
 *
 * Detection covers every source `resolveDatadogApiKey` accepts, including
 * `DD_API_KEY` and the `SECRET_<NAME>` / `<NAME>_SECRET` references that
 * `getEnvSecret` resolves, so a key held only in Secrets Manager still enables
 * metric submission. Nothing is resolved here.
 */
export default function hasDatadogEnv(): boolean {
  return findDatadogKeySource(DATADOG_API_KEY_ENV) !== null;
}
