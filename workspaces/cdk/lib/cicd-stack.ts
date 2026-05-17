import { CfnOutput, Fn, Stack } from "aws-cdk-lib";
import {
  Effect,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { CDK } from "@jaypie/constructs";

export class CicdStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, { stackName: "jaypie-cicd" });

    const oidcProviderArn =
      process.env.CDK_ENV_OIDC_PROVIDER_ARN ??
      Fn.importValue(CDK.IMPORT.OIDC_PROVIDER);

    const bedrockRole = new Role(this, "BedrockTestRole", {
      assumedBy: new FederatedPrincipal(
        oidcProviderArn,
        {
          StringLike: {
            "token.actions.githubusercontent.com:sub":
              "repo:finlaysonstudio/jaypie:*",
          },
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    bedrockRole.addToPolicy(
      new PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        effect: Effect.ALLOW,
        resources: ["arn:aws:bedrock:*::foundation-model/*"],
      }),
    );

    new CfnOutput(this, "BedrockCicdRoleArn", {
      exportName: "jaypie-cicd-bedrock-role-arn",
      value: bedrockRole.roleArn,
    });
  }
}
