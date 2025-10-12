import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "../constants";

export function mergeDomain(subDomain: string, hostedZone: string): string {
  if (!hostedZone) {
    throw new ConfigurationError("hostedZone is required");
  }
  if (!subDomain) {
    // Return hostedZone if subDomain is not passed
    // Pass CDK.HOST.APEX to explicitly indicate apex domain
    return hostedZone;
  }
  if (subDomain === CDK.HOST.APEX) {
    return hostedZone;
  }
  return `${subDomain}.${hostedZone}`;
}
