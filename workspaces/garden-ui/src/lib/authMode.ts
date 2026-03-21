export type AuthMode = "auth0" | "bypass";

export function getAuthMode(): AuthMode {
  return process.env.DANGEROUS_BYPASS_AUTHENTICATION === "true"
    ? "bypass"
    : "auth0";
}
