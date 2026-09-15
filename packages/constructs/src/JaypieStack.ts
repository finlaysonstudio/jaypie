import { Annotations, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { constructStackName, constructTagger } from "./helpers";

const PROJECT_NONCE_PATTERN = /^[0-9a-f]{6,}$/;
const WARNING_PROJECT_NONCE_FORMAT = "@jaypie/constructs:projectNonceFormat";

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

    // Warn before a word or branch-name nonce becomes an immutable name
    const nonce = process.env.PROJECT_NONCE;
    if (
      process.env.CDK_DEFAULT_ACCOUNT &&
      !PROJECT_NONCE_PATTERN.test(nonce ?? "")
    ) {
      Annotations.of(this).addWarningV2(
        WARNING_PROJECT_NONCE_FORMAT,
        `PROJECT_NONCE ${nonce ? `"${nonce}" is not lowercase hex` : "is unset"}. Stack, bucket, and parameter names built from it are immutable and can repeat across projects and accounts. Generate one per environment with "openssl rand -hex 4". See skill("cicd-environments").`,
      );
    }
  }
}
