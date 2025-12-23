import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import { ConfigurationError } from "@jaypie/errors";
import { cdkLog } from "./cdkLog";

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
  cdkLog("resolveHostedZone called", {
    name,
    zone: typeof zone === "string" ? zone : "(IHostedZone object)",
    CDK_ENV_HOSTED_ZONE: process.env.CDK_ENV_HOSTED_ZONE,
  });

  if (!zone) {
    throw new ConfigurationError(
      "No `zone` provided. Set CDK_ENV_HOSTED_ZONE to use environment zone",
    );
  }

  if (typeof zone === "string") {
    cdkLog("resolveHostedZone: looking up zone by domain name", {
      domainName: zone,
    });
    return route53.HostedZone.fromLookup(scope, name, {
      domainName: zone,
    });
  }
  cdkLog("resolveHostedZone: using provided IHostedZone object");
  return zone;
}
