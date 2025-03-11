import { Construct } from "constructs";
import { CDK } from "@jaypie/cdk";
import { JaypieEnvSecret, JaypieEnvSecretProps } from "./JaypieEnvSecret";

export class JaypieTraceSigningKeySecret extends JaypieEnvSecret {
  constructor(
    scope: Construct,
    id = "TraceSigningKey",
    props?: JaypieEnvSecretProps,
  ) {
    const defaultProps: JaypieEnvSecretProps = {
      envKey: "TRACE_SIGNING_KEY",
      roleTag: CDK.ROLE.API,
      vendorTag: CDK.VENDOR.KNOWTRACE,
      ...props,
    };

    super(scope, id, defaultProps);
  }
}
