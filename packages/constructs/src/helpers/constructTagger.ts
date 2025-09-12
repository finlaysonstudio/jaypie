import { Construct } from "constructs";
import { Tags } from "aws-cdk-lib";
import { constructStackName } from "./constructStackName";

const CDK = {
  CREATION: {
    CDK: "cdk",
  },
  ROLE: {
    STACK: "stack",
  },
  TAG: {
    BUILD_DATE: "buildDate",
    BUILD_HEX: "buildHex",
    BUILD_TIME: "buildTime",
    COMMIT: "commit",
    CREATION: "creation",
    ENV: "env",
    NONCE: "nonce",
    PROJECT: "project",
    ROLE: "role",
    SERVICE: "service",
    SPONSOR: "sponsor",
    STACK: "stack",
    STACK_SHA: "stackSha",
    VERSION: "version",
  },
};

export function constructTagger(
  construct: Construct,
  { name }: { name?: string } = {},
): boolean {
  const stackName = name || constructStackName();
  const version =
    process.env.npm_package_version || process.env.PROJECT_VERSION || null;

  if (process.env.PROJECT_COMMIT && process.env.PROJECT_COMMIT.length > 8) {
    Tags.of(construct).add(
      CDK.TAG.BUILD_HEX,
      process.env.PROJECT_COMMIT.slice(0, 8),
    );
  }
  Tags.of(construct).add(CDK.TAG.BUILD_DATE, new Date().toISOString());
  Tags.of(construct).add(CDK.TAG.BUILD_TIME, Date.now().toString());
  if (process.env.PROJECT_COMMIT)
    Tags.of(construct).add(CDK.TAG.COMMIT, process.env.PROJECT_COMMIT);
  Tags.of(construct).add(CDK.TAG.CREATION, CDK.CREATION.CDK);
  if (process.env.PROJECT_ENV)
    Tags.of(construct).add(CDK.TAG.ENV, process.env.PROJECT_ENV);
  if (process.env.PROJECT_NONCE)
    Tags.of(construct).add(CDK.TAG.NONCE, process.env.PROJECT_NONCE);
  if (process.env.PROJECT_KEY)
    Tags.of(construct).add(CDK.TAG.PROJECT, process.env.PROJECT_KEY);
  Tags.of(construct).add(CDK.TAG.ROLE, CDK.ROLE.STACK);
  if (process.env.PROJECT_SERVICE)
    Tags.of(construct).add(CDK.TAG.SERVICE, process.env.PROJECT_SERVICE);
  if (process.env.PROJECT_SPONSOR)
    Tags.of(construct).add(CDK.TAG.SPONSOR, process.env.PROJECT_SPONSOR);
  if (stackName) Tags.of(construct).add(CDK.TAG.STACK, stackName);
  if (version) Tags.of(construct).add(CDK.TAG.VERSION, version);

  return true;
}
