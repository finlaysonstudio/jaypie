import { CfnOutput, Stack } from "aws-cdk-lib";
import {
  Effect,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class CicdStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, { stackName: "jaypie-cicd" });

    const oidcProviderArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    const bedrockRole = new Role(this, "BedrockTestRole", {
      roleName: "jaypie-cicd-bedrock-test",
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
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
        ],
      }),
    );

    new CfnOutput(this, "BedrockCicdRoleArn", {
      exportName: "jaypie-cicd-bedrock-role-arn",
      value: bedrockRole.roleArn,
    });
  }
}
