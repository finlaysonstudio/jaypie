import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Annotations, Match } from "aws-cdk-lib/assertions";

import { JaypieStack } from "../JaypieStack.js";

//
//
// Constants
//

const ACCOUNT = "123456789012";
const WARNING_ID = "@jaypie/constructs:projectNonceFormat";

//
//
// Helpers
//

function nonceWarnings(stack: JaypieStack) {
  return Annotations.fromStack(stack).findWarning(
    "*",
    Match.stringLikeRegexp(WARNING_ID),
  );
}

function synthStack() {
  const app = new App();
  return new JaypieStack(app, "TestStack");
}

//
//
// Tests
//

describe("Issue #554: JaypieStack warns on a non-hex PROJECT_NONCE", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CDK_DEFAULT_ACCOUNT = ACCOUNT;
    process.env.CDK_DEFAULT_REGION = "us-east-1";
    process.env.PROJECT_ENV = "sandbox";
    process.env.PROJECT_KEY = "project";
    process.env.PROJECT_SPONSOR = "sponsor";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not warn for an 8-character hex nonce", () => {
    process.env.PROJECT_NONCE = "ba342b91";
    expect(nonceWarnings(synthStack())).toHaveLength(0);
  });

  it("warns when PROJECT_NONCE is unset", () => {
    delete process.env.PROJECT_NONCE;
    expect(nonceWarnings(synthStack())).toHaveLength(1);
  });

  it("warns when PROJECT_NONCE is a branch name", () => {
    process.env.PROJECT_NONCE = "develop";
    expect(nonceWarnings(synthStack())).toHaveLength(1);
  });

  it("warns when PROJECT_NONCE is a word", () => {
    process.env.PROJECT_NONCE = "prod";
    expect(nonceWarnings(synthStack())).toHaveLength(1);
  });

  it("does not warn without a deploy account", () => {
    delete process.env.CDK_DEFAULT_ACCOUNT;
    delete process.env.PROJECT_NONCE;
    expect(nonceWarnings(synthStack())).toHaveLength(0);
  });
});
