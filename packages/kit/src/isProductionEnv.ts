const PROJECT_ENV_PRODUCTION = "production";
const PROJECT_PRODUCTION_TRUE = "true";

export function isProductionEnv(): boolean {
  return (
    process.env.PROJECT_ENV === PROJECT_ENV_PRODUCTION ||
    process.env.PROJECT_PRODUCTION === PROJECT_PRODUCTION_TRUE
  );
}
