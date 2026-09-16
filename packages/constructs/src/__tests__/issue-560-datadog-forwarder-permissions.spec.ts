import { describe, expect, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { Bucket, EventType } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";

import { resolveDatadogForwarderFunction } from "../helpers/resolveDatadogForwarderFunction.js";
import { JaypieDatadogForwarder } from "../JaypieDatadogForwarder.js";

//
//
// Constants
//

const ACCOUNT = "123456789012";
const DATADOG_API_KEY = "0123456789abcdef0123456789abcdef";
const LAMBDA_WARNING_ID = "UnclearLambdaEnvironment";
const REGION = "us-east-1";
const RULE_WARNING_ID = "@aws-cdk/aws-events:ruleUnresolvedEnvironment";

//
//
// Helpers
//

function findInvokePermissions(stack: Stack, principal: string) {
  return Object.keys(
    Template.fromStack(stack).findResources("AWS::Lambda::Permission", {
      Properties: {
        Action: "lambda:InvokeFunction",
        Principal: principal,
      },
    }),
  );
}

function findWarnings(stack: Stack, id: string) {
  return Annotations.fromStack(stack).findWarning(
    "*",
    Match.stringLikeRegexp(id),
  );
}

function newStack() {
  const app = new App();
  return new Stack(app, "TestStack", {
    env: { account: ACCOUNT, region: REGION },
  });
}

function stackWithForwarder() {
  const stack = newStack();
  new JaypieDatadogForwarder(stack, { datadogApiKey: DATADOG_API_KEY });
  return stack;
}

function stackWithNotifiedBucket() {
  const stack = newStack();
  const bucket = new Bucket(stack, "LogBucket");
  bucket.addEventNotification(
    EventType.OBJECT_CREATED,
    new LambdaDestination(resolveDatadogForwarderFunction(stack)),
  );
  return stack;
}

//
//
// Tests
//

describe("Issue #560: Datadog forwarder imports create invoke permissions", () => {
  describe("JaypieDatadogForwarder", () => {
    it("creates an events invoke permission for the CloudFormation rule", () => {
      expect(
        findInvokePermissions(stackWithForwarder(), "events.amazonaws.com"),
      ).toHaveLength(1);
    });

    it("does not warn the lambda environment is unclear", () => {
      expect(
        findWarnings(stackWithForwarder(), LAMBDA_WARNING_ID),
      ).toHaveLength(0);
    });

    it("does not warn the rule environment is unresolved", () => {
      expect(findWarnings(stackWithForwarder(), RULE_WARNING_ID)).toHaveLength(
        0,
      );
    });
  });

  describe("resolveDatadogForwarderFunction", () => {
    it("creates an s3 invoke permission for a bucket notification", () => {
      expect(
        findInvokePermissions(stackWithNotifiedBucket(), "s3.amazonaws.com"),
      ).toHaveLength(1);
    });

    it("does not warn the lambda environment is unclear", () => {
      expect(
        findWarnings(stackWithNotifiedBucket(), LAMBDA_WARNING_ID),
      ).toHaveLength(0);
    });
  });
});
