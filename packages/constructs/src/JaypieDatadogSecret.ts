import { Construct } from "constructs";
import { CDK } from "./constants";
import { JaypieEnvSecret, JaypieEnvSecretProps } from "./JaypieEnvSecret";

export class JaypieDatadogSecret extends JaypieEnvSecret {
  constructor(
    scope: Construct,
    id = "MongoConnectionString",
    props?: JaypieEnvSecretProps,
  ) {
    const defaultProps: JaypieEnvSecretProps = {
      envKey: "DATADOG_API_KEY",
      roleTag: CDK.ROLE.MONITORING,
      vendorTag: CDK.VENDOR.DATADOG,
      ...props,
    };

    super(scope, id, defaultProps);
  }
}
