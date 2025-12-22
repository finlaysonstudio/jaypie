const PROJECT_ENV_LOCAL = "local";
const NODE_ENV_DEVELOPMENT = "development";

export function isLocalEnv(): boolean {
  if (process.env.PROJECT_ENV !== undefined) {
    return process.env.PROJECT_ENV === PROJECT_ENV_LOCAL;
  }
  return process.env.NODE_ENV === NODE_ENV_DEVELOPMENT;
}
