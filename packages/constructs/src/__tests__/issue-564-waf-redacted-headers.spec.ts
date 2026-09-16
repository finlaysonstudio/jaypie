import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";

import {
  DEFAULT_WAF_REDACTED_HEADERS,
  JaypieDistribution,
  JaypieWafConfig,
} from "../JaypieDistribution";
import {
  JaypieWebDeploymentBucket,
  JaypieWebDeploymentBucketWafConfig,
} from "../JaypieWebDeploymentBucket";

//
//
// Constants
//

const WAF_REDACTED_FIELDS_LIMIT = 100;

//
//
// Helpers
//

interface FieldToMatch {
  QueryString?: unknown;
  SingleHeader?: { Name: string };
  UriPath?: unknown;
}

function redactedFields(template: Template): FieldToMatch[] | undefined {
  const resources = template.findResources(
    "AWS::WAFv2::LoggingConfiguration",
  ) as Record<string, { Properties: { RedactedFields?: FieldToMatch[] } }>;
  const configurations = Object.values(resources);
  expect(configurations).toHaveLength(1);
  return configurations[0].Properties.RedactedFields;
}

function redactedHeaderNames(template: Template): string[] {
  return (redactedFields(template) ?? [])
    .map((field) => field.SingleHeader?.Name)
    .filter((name): name is string => typeof name === "string");
}

function synthDistribution(waf: boolean | JaypieWafConfig = true) {
  const stack = new Stack();
  const bucket = new s3.Bucket(stack, "TestBucket");
  new JaypieDistribution(stack, "TestDistribution", {
    handler: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    waf,
  });
  return Template.fromStack(stack);
}

function synthWebDeploymentBucket(
  waf: boolean | JaypieWebDeploymentBucketWafConfig = true,
) {
  const stack = new Stack(undefined, "Stack", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const zone = new route53.HostedZone(stack, "Zone", {
    zoneName: "example.com",
  });
  new JaypieWebDeploymentBucket(stack, "TestWeb", {
    host: "app.example.com",
    waf,
    zone,
  });
  return Template.fromStack(stack);
}

//
//
// Tests
//

describe("Issue #564: WAF logging redacted headers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_WEB_HOST;
    delete process.env.CDK_ENV_WEB_HOSTED_ZONE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("names the default headers in alphabetical order", () => {
      expect(DEFAULT_WAF_REDACTED_HEADERS).toEqual([
        "authorization",
        "cookie",
        "x-amz-content-sha256",
        "x-api-key",
      ]);
    });
  });

  describe("Error Conditions", () => {
    it("throws when the redacted field list exceeds the AWS limit", () => {
      const tooMany = Array.from(
        { length: WAF_REDACTED_FIELDS_LIMIT + 1 },
        (_unused, index) => `x-header-${index}`,
      );
      expect(() =>
        synthDistribution({ name: "custom", redactedHeaders: tooMany }),
      ).toThrow(ConfigurationError);
    });
  });

  describe("Features", () => {
    describe("JaypieDistribution", () => {
      it("redacts the default headers with waf: true", () => {
        const template = synthDistribution(true);
        expect(redactedHeaderNames(template)).toEqual(
          DEFAULT_WAF_REDACTED_HEADERS,
        );
      });

      it("redacts the body hash origin access control requires", () => {
        const template = synthDistribution(true);
        expect(redactedHeaderNames(template)).toContain("x-amz-content-sha256");
      });

      it("replaces the default list with a custom redactedHeaders list", () => {
        const template = synthDistribution({
          name: "custom",
          redactedHeaders: ["x-session-token"],
        });
        expect(redactedHeaderNames(template)).toEqual(["x-session-token"]);
      });

      it("redacts nothing when redactedHeaders is an empty array", () => {
        const template = synthDistribution({
          name: "custom",
          redactedHeaders: [],
        });
        expect(redactedFields(template)).toBeUndefined();
      });

      it("appends a redactedFields passthrough after the headers", () => {
        const template = synthDistribution({
          name: "custom",
          redactedFields: [{ queryString: {} }, { uriPath: {} }],
          redactedHeaders: ["x-api-key"],
        });
        expect(redactedFields(template)).toEqual([
          { SingleHeader: { Name: "x-api-key" } },
          { QueryString: {} },
          { UriPath: {} },
        ]);
      });
    });

    describe("JaypieWebDeploymentBucket", () => {
      it("redacts the default headers with waf: true", () => {
        const template = synthWebDeploymentBucket(true);
        expect(redactedHeaderNames(template)).toEqual(
          DEFAULT_WAF_REDACTED_HEADERS,
        );
      });

      it("replaces the default list with a custom redactedHeaders list", () => {
        const template = synthWebDeploymentBucket({
          redactedHeaders: ["x-session-token"],
        });
        expect(redactedHeaderNames(template)).toEqual(["x-session-token"]);
      });

      it("redacts nothing when redactedHeaders is an empty array", () => {
        const template = synthWebDeploymentBucket({ redactedHeaders: [] });
        expect(redactedFields(template)).toBeUndefined();
      });

      it("appends a redactedFields passthrough after the headers", () => {
        const template = synthWebDeploymentBucket({
          redactedFields: [{ uriPath: {} }],
          redactedHeaders: ["cookie"],
        });
        expect(redactedFields(template)).toEqual([
          { SingleHeader: { Name: "cookie" } },
          { UriPath: {} },
        ]);
      });
    });
  });
});
