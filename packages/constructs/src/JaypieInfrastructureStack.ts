import { Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { JaypieStack, JaypieStackProps } from "./JaypieStack";
import { constructStackName } from "./helpers";

const CDK = {
  TAG: {
    STACK_SHA: "stackSha",
  },
};

export class JaypieInfrastructureStack extends JaypieStack {
  constructor(scope: Construct, id: string, props: JaypieStackProps = {}) {
    const { key = "infra", ...stackProps } = props;

    // Handle stackName
    if (!stackProps.stackName) {
      stackProps.stackName = constructStackName(key);
    }

    super(scope, id, { key, ...stackProps });

    // Add infrastructure-specific tag
    if (process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA) {
      Tags.of(this).add(
        CDK.TAG.STACK_SHA,
        process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA,
      );
    }
  }
}
