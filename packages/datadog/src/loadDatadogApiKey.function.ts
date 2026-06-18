import { getSecret } from "@jaypie/aws";
import { log } from "@jaypie/logger";

import { DATADOG } from "./constants.js";

//
//
// Helpers
//

/**
 * True when LLM Observability is opted in via `DD_LLMOBS_ENABLED`.
 * Accepts any truthy value except "false"/"0".
 */
function isLlmObsEnabled(): boolean {
  const value = process.env[DATADOG.ENV.DD_LLMOBS_ENABLED];
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
}

//
//
// Main
//

/**
 * Populate `DD_API_KEY` in the environment from `DD_API_KEY_SECRET_ARN` so
 * dd-trace LLM Observability can authenticate.
 *
 * No-op unless all of the following hold:
 * - `DD_LLMOBS_ENABLED` is truthy (anything but "false"/"0")
 * - `DD_API_KEY_SECRET_ARN` is present
 * - `DD_API_KEY` is absent
 * - `DATADOG_API_KEY` is absent
 *
 * @returns `true` when the key was fetched and set, otherwise `false`.
 */
export default async function loadDatadogApiKey(): Promise<boolean> {
  if (!isLlmObsEnabled()) {
    return false;
  }

  const secretArn = process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
  if (
    !secretArn ||
    process.env[DATADOG.ENV.DD_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY]
  ) {
    return false;
  }

  log.trace("[@jaypie/datadog] Loading DD_API_KEY from DD_API_KEY_SECRET_ARN");
  const secret = await getSecret(secretArn);
  if (!secret) {
    log.warn("[@jaypie/datadog] DD_API_KEY_SECRET_ARN could not be resolved");
    return false;
  }

  process.env[DATADOG.ENV.DD_API_KEY] = secret;
  return true;
}
