//
//
// Function
//

import { DATADOG } from "./constants.js";

export default function hasDatadogEnv(): boolean {
  return !!(
    process.env[DATADOG.ENV.DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] ||
    process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN]
  );
}
