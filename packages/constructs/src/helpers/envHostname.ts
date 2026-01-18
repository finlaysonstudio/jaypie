import { ConfigurationError } from "@jaypie/errors";
import { CDK } from "../constants";

/**
 * Configuration for resolving a hostname from parts.
 * Used by envHostname() to construct domain names from environment and config.
 */
export interface HostConfig {
  component?: string;
  domain?: string;
  env?: string;
  subdomain?: string;
}

export function envHostname({
  component,
  domain,
  env,
  subdomain,
}: HostConfig = {}) {
  const resolvedDomain =
    domain || process.env.CDK_ENV_DOMAIN || process.env.CDK_ENV_HOSTED_ZONE;

  if (!resolvedDomain) {
    throw new ConfigurationError(
      "No hostname `domain` provided. Set CDK_ENV_DOMAIN or CDK_ENV_HOSTED_ZONE to use environment domain",
    );
  }

  const resolvedComponent =
    component === "@" || component === "" ? undefined : component;
  const providedSubdomain =
    subdomain === "@" || subdomain === "" ? undefined : subdomain;
  const resolvedSubdomain = providedSubdomain || process.env.CDK_ENV_SUBDOMAIN;
  const resolvedEnv = env || process.env.PROJECT_ENV;
  const filteredEnv =
    resolvedEnv === CDK.ENV.PRODUCTION ? undefined : resolvedEnv;

  // Check if parts are already contained in the domain to avoid duplication
  const domainParts = resolvedDomain.split(".");

  const isPartInDomain = (part: string | undefined): boolean => {
    if (!part) return false;
    return domainParts.includes(part);
  };

  const parts = [
    isPartInDomain(resolvedComponent) ? undefined : resolvedComponent,
    isPartInDomain(resolvedSubdomain) ? undefined : resolvedSubdomain,
    isPartInDomain(filteredEnv) ? undefined : filteredEnv,
    resolvedDomain,
  ].filter((part) => part);

  return parts.join(".");
}
