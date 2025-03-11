import { Construct } from "constructs";
import { CDK } from "@jaypie/cdk";
import { JaypieEnvSecret, JaypieEnvSecretProps } from "./JaypieEnvSecret";

export class JaypieMongoDbSecret extends JaypieEnvSecret {
  constructor(
    scope: Construct,
    id = "MongoConnectionString",
    props?: JaypieEnvSecretProps,
  ) {
    const defaultProps: JaypieEnvSecretProps = {
      envKey: "MONGODB_URI",
      roleTag: CDK.ROLE.STORAGE,
      vendorTag: CDK.VENDOR.MONGODB,
      ...props,
    };

    super(scope, id, defaultProps);
  }
}
