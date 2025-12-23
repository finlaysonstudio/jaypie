/**
 * Conditional logging for CDK constructs.
 * Only logs when CDK_ENV_LOG=true is set.
 */
/* eslint-disable no-console */
export function cdkLog(message: string, data?: unknown): void {
  if (process.env.CDK_ENV_LOG === "true") {
    if (data !== undefined) {
      console.log(`[CDK] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[CDK] ${message}`);
    }
  }
}
/* eslint-enable no-console */
