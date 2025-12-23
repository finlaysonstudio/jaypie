import { ConfigurationError } from "@jaypie/errors";
import { CDK } from "../constants";
import { cdkLog } from "./cdkLog";

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
  cdkLog("envHostname called", {
    params: { component, domain, env, subdomain },
    envVars: {
      CDK_ENV_DOMAIN: process.env.CDK_ENV_DOMAIN,
      CDK_ENV_HOSTED_ZONE: process.env.CDK_ENV_HOSTED_ZONE,
      CDK_ENV_SUBDOMAIN: process.env.CDK_ENV_SUBDOMAIN,
      PROJECT_ENV: process.env.PROJECT_ENV,
    },
  });

  const resolvedDomain =
    domain || process.env.CDK_ENV_DOMAIN || process.env.CDK_ENV_HOSTED_ZONE;

  if (!resolvedDomain) {
    throw new ConfigurationError(
      "No hostname `domain` provided. Set CDK_ENV_DOMAIN or CDK_ENV_HOSTED_ZONE to use environment domain",
    );
  }

  const resolvedComponent =
    component === "@" || component === "" ? undefined : component;
  const resolvedSubdomain = subdomain || process.env.CDK_ENV_SUBDOMAIN;
  const resolvedEnv = env || process.env.PROJECT_ENV;
  const filteredEnv =
    resolvedEnv === CDK.ENV.PRODUCTION ? undefined : resolvedEnv;

  const parts = [
    resolvedComponent,
    resolvedSubdomain,
    filteredEnv,
    resolvedDomain,
  ].filter((part) => part);

  const hostname = parts.join(".");
  cdkLog("envHostname resolved", { hostname });

  return hostname;
}
