import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import { ConfigurationError } from "@jaypie/errors";

export function resolveHostedZone(
  scope: Construct,
  {
    name = "HostedZone",
    zone = process.env.CDK_ENV_HOSTED_ZONE,
  }: {
    name?: string;
    zone?: string | route53.IHostedZone;
  } = {},
): route53.IHostedZone {
  if (!zone) {
    throw new ConfigurationError(
      "No `zone` provided. Set CDK_ENV_HOSTED_ZONE to use environment zone",
    );
  }

  if (typeof zone === "string") {
    return route53.HostedZone.fromLookup(scope, name, {
      domainName: zone,
    });
  }
  return zone;
}
