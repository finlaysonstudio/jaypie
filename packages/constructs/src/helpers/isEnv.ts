import { CDK } from "@jaypie/cdk";

/**
 * Check if the current environment matches the given environment
 */
export function isEnv(env: string): boolean {
  return process.env.PROJECT_ENV === env;
}

/**
 * Check if the current environment is production
 */
export function isProductionEnv(): boolean {
  return isEnv(CDK.ENV.PRODUCTION);
}

/**
 * Check if the current environment is sandbox
 */
export function isSandboxEnv(): boolean {
  return isEnv(CDK.ENV.SANDBOX);
}
