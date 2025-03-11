import { Construct } from "constructs";
import { CDK } from "@jaypie/cdk";
import { JaypieEnvSecret, JaypieEnvSecretProps } from "./JaypieEnvSecret";

export class JaypieOpenAiSecret extends JaypieEnvSecret {
  constructor(
    scope: Construct,
    id = "OpenAiApiKey",
    props?: JaypieEnvSecretProps,
  ) {
    const defaultProps: JaypieEnvSecretProps = {
      envKey: "OPENAI_API_KEY",
      roleTag: CDK.ROLE.PROCESSING,
      vendorTag: CDK.VENDOR.OPENAI,
      ...props,
    };

    super(scope, id, defaultProps);
  }
}
