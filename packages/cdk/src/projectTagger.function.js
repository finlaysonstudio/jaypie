const { CDK } = require("./constants.js");
const { ConfigurationError } = require("@jaypie/core");

module.exports = ({ cdk, stack, stackName } = {}) => {
  if (!cdk) {
    throw new ConfigurationError("projectTagger `cdk` is required");
  }
  if (!stack) {
    throw new ConfigurationError("projectTagger `stack` is required");
  }
  const version =
    process.env.npm_package_version || process.env.PROJECT_VERSION || null;

  if (process.env.PROJECT_COMMIT && process.env.PROJECT_COMMIT.length > 8) {
    cdk.Tags.of(stack).add(
      CDK.TAG.BUILD_HEX,
      process.env.PROJECT_COMMIT.slice(0, 8),
    );
  }
  cdk.Tags.of(stack).add(CDK.TAG.BUILD_DATE, new Date().toISOString());
  cdk.Tags.of(stack).add(CDK.TAG.BUILD_TIME, Date.now().toString());
  if (process.env.PROJECT_COMMIT)
    cdk.Tags.of(stack).add(CDK.TAG.COMMIT, process.env.PROJECT_COMMIT);
  cdk.Tags.of(stack).add(CDK.TAG.CREATION, CDK.CREATION.CDK);
  if (process.env.PROJECT_ENV)
    cdk.Tags.of(stack).add(CDK.TAG.ENV, process.env.PROJECT_ENV);
  if (process.env.PROJECT_NONCE)
    cdk.Tags.of(stack).add(CDK.TAG.NONCE, process.env.PROJECT_NONCE);
  if (process.env.PROJECT_KEY)
    cdk.Tags.of(stack).add(CDK.TAG.PROJECT, process.env.PROJECT_KEY);
  cdk.Tags.of(stack).add(CDK.TAG.ROLE, CDK.ROLE.STACK);
  if (process.env.PROJECT_SERVICE)
    cdk.Tags.of(stack).add(CDK.TAG.SERVICE, process.env.PROJECT_SERVICE);
  if (process.env.PROJECT_SPONSOR)
    cdk.Tags.of(stack).add(CDK.TAG.SPONSOR, process.env.PROJECT_SPONSOR);
  if (stackName) cdk.Tags.of(stack).add(CDK.TAG.STACK, stackName);
  if (version) cdk.Tags.of(stack).add(CDK.TAG.VERSION, version);

  return true;
};
