import { ConfigurationError } from "@jaypie/errors";
import { CDK } from "../constants";

export function envHostname({
  component,
  domain,
  env,
  subdomain,
}: {
  component?: string;
  domain?: string;
  env?: string;
  subdomain?: string;
} = {}) {
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

  const parts = [
    resolvedComponent,
    resolvedSubdomain,
    filteredEnv,
    resolvedDomain,
  ].filter((part) => part);

  return parts.join(".");
}
