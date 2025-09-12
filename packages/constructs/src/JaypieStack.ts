import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { constructStackName, constructTagger } from "./helpers";

export interface JaypieStackProps extends StackProps {
  key?: string;
}

export class JaypieStack extends Stack {
  constructor(scope: Construct, id: string, props: JaypieStackProps = {}) {
    const { key, ...stackProps } = props;

    // Handle stackName
    if (!stackProps.stackName) {
      stackProps.stackName = constructStackName(key);
    }

    // Handle env
    stackProps.env = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
      ...stackProps.env,
    };

    super(scope, id, stackProps);

    // Apply tags
    constructTagger(this, { name: stackProps.stackName });
  }
}
