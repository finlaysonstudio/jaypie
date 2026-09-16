import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { JaypieDistribution } from "../JaypieDistribution";
import { JaypieWebDeploymentBucket } from "../JaypieWebDeploymentBucket";

//
//
// Constants
//

const ACCOUNT = "111111111111";

const BLOCK_ALL = {
  BlockPublicAcls: true,
  BlockPublicPolicy: true,
  IgnorePublicAcls: true,
  RestrictPublicBuckets: true,
};

const DEFAULT_RETENTION_DAYS = 365;

const LOG_DELIVERY_SERVICE_PRINCIPAL = "delivery.logs.amazonaws.com";

const REGION = "us-east-1";

const WAF_NAME = "ingress";

//
//
// Types
//

interface PolicyStatement {
  Action: string | string[];
  Condition?: Record<string, Record<string, unknown>>;
  Effect: string;
  Principal?: { AWS?: string; Service?: string };
  Sid?: string;
}

interface ResourceEntry {
  DeletionPolicy?: string;
  Properties: Record<string, never> & Record<string, unknown>;
  UpdateReplacePolicy?: string;
}

//
//
// Helpers
//

function autoDeleteBucketRefs(template: Template): string[] {
  return Object.values(template.findResources("Custom::S3AutoDeleteObjects"))
    .map((resource) => (resource as ResourceEntry).Properties.BucketName)
    .map((bucketName) => (bucketName as { Ref?: string })?.Ref ?? "")
    .filter(Boolean);
}

function findBucket(
  template: Template,
  { waf = false }: { waf?: boolean } = {},
): [string, ResourceEntry] {
  const entries = Object.entries(template.findResources("AWS::S3::Bucket"))
    .filter(([logicalId]) =>
      waf
        ? logicalId.includes("WafLogBucket")
        : logicalId.includes("LogBucket") &&
          !logicalId.includes("WafLogBucket"),
    )
    .map(([logicalId, resource]) => [logicalId, resource as ResourceEntry]);
  expect(entries).toHaveLength(1);
  return entries[0] as [string, ResourceEntry];
}

function findPolicyStatements(
  template: Template,
  bucketLogicalId: string,
): PolicyStatement[] {
  const policies = Object.values(
    template.findResources("AWS::S3::BucketPolicy"),
  ).filter(
    (resource) =>
      ((resource as ResourceEntry).Properties.Bucket as { Ref?: string })
        ?.Ref === bucketLogicalId,
  );
  expect(policies).toHaveLength(1);
  return (
    (policies[0] as ResourceEntry).Properties.PolicyDocument as {
      Statement: PolicyStatement[];
    }
  ).Statement;
}

function lifecycleRules(bucket: ResourceEntry): Record<string, unknown>[] {
  return (
    bucket.Properties.LifecycleConfiguration as {
      Rules: Record<string, unknown>[];
    }
  ).Rules;
}

function secureTransportDeny(
  statements: PolicyStatement[],
): PolicyStatement | undefined {
  return statements.find(
    (statement) =>
      statement.Effect === "Deny" &&
      statement.Condition?.Bool?.["aws:SecureTransport"] === "false",
  );
}

function statementBySid(
  statements: PolicyStatement[],
  sid: string,
): PolicyStatement | undefined {
  return statements.find((statement) => statement.Sid === sid);
}

function synthDistribution(props: Record<string, unknown> = {}): Template {
  const stack = new Stack(undefined, "DistributionStack", {
    env: { account: ACCOUNT, region: REGION },
  });
  const handler = new lambda.Function(stack, "TestFunction", {
    code: lambda.Code.fromInline("exports.handler = () => {}"),
    handler: "index.handler",
    runtime: lambda.Runtime.NODEJS_22_X,
  });
  new JaypieDistribution(stack, "TestDistribution", {
    handler,
    waf: { name: WAF_NAME },
    ...props,
  });
  return Template.fromStack(stack);
}

function synthWeb(props: Record<string, unknown> = {}): Template {
  const stack = new Stack(undefined, "WebStack", {
    env: { account: ACCOUNT, region: REGION },
  });
  new JaypieWebDeploymentBucket(stack, "TestWeb", {
    waf: { name: WAF_NAME },
    ...props,
  });
  return Template.fromStack(stack);
}

//
//
// Tests
//

describe("Issue #561: default log bucket hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_REPO;
    delete process.env.CDK_ENV_WEB_HOST;
    delete process.env.CDK_ENV_WEB_HOSTED_ZONE;
    delete process.env.CDK_ENV_WEB_SUBDOMAIN;
    delete process.env.PROJECT_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("synthesizes both constructs with default logging", () => {
      expect(() => synthDistribution()).not.toThrow();
      expect(() => synthWeb()).not.toThrow();
    });
  });

  describe.each([
    ["JaypieDistribution", synthDistribution],
    ["JaypieWebDeploymentBucket", synthWeb],
  ])("%s", (_name, synth) => {
    describe.each([
      ["CloudFront access log bucket", false],
      ["WAF log bucket", true],
    ])("%s", (_bucketName, waf) => {
      it("blocks all public access", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual(
          BLOCK_ALL,
        );
      });

      it("enables versioning", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(bucket.Properties.VersioningConfiguration).toEqual({
          Status: "Enabled",
        });
      });

      it("encrypts objects with SSE-S3", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(bucket.Properties.BucketEncryption).toEqual({
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
          ],
        });
      });

      it("keeps object writer ownership for CloudFront standard logging", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(bucket.Properties.OwnershipControls).toEqual({
          Rules: [{ ObjectOwnership: "ObjectWriter" }],
        });
      });

      it("expires logs after 365 days", () => {
        const [, bucket] = findBucket(synth(), { waf });
        const rules = lifecycleRules(bucket);
        expect(rules).toHaveLength(1);
        expect(rules[0].ExpirationInDays).toBe(DEFAULT_RETENTION_DAYS);
        expect(rules[0].Status).toBe("Enabled");
      });

      it("expires noncurrent versions on the same schedule", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(lifecycleRules(bucket)[0].NoncurrentVersionExpiration).toEqual({
          NoncurrentDays: DEFAULT_RETENTION_DAYS,
        });
      });

      it("retains the bucket when the stack is deleted", () => {
        const [, bucket] = findBucket(synth(), { waf });
        expect(bucket.DeletionPolicy).toBe("Retain");
        expect(bucket.UpdateReplacePolicy).toBe("Retain");
      });

      it("denies requests that are not over TLS", () => {
        const template = synth();
        const [logicalId] = findBucket(template, { waf });
        const deny = secureTransportDeny(
          findPolicyStatements(template, logicalId),
        );
        expect(deny).toBeDefined();
        expect(deny?.Action).toBe("s3:*");
        expect(deny?.Principal).toEqual({ AWS: "*" });
      });

      it("creates no auto-delete custom resource for the log bucket", () => {
        const template = synth();
        const [logicalId] = findBucket(template, { waf });
        expect(autoDeleteBucketRefs(template)).not.toContain(logicalId);
      });

      it("honors a numeric logRetention", () => {
        const [, bucket] = findBucket(synth({ logRetention: 30 }), { waf });
        const rules = lifecycleRules(bucket);
        expect(rules[0].ExpirationInDays).toBe(30);
        expect(rules[0].Transitions).toBeUndefined();
      });

      it("honors a Duration logRetention", () => {
        const [, bucket] = findBucket(
          synth({ logRetention: Duration.days(730) }),
          { waf },
        );
        expect(lifecycleRules(bucket)[0].ExpirationInDays).toBe(730);
      });
    });

    describe("WAF log delivery", () => {
      it("allows the log delivery service to check the bucket ACL", () => {
        const template = synth();
        const [logicalId] = findBucket(template, { waf: true });
        const statement = statementBySid(
          findPolicyStatements(template, logicalId),
          "AWSLogDeliveryAclCheck",
        );
        expect(statement).toBeDefined();
        expect(statement?.Effect).toBe("Allow");
        expect(statement?.Action).toBe("s3:GetBucketAcl");
        expect(statement?.Principal).toEqual({
          Service: LOG_DELIVERY_SERVICE_PRINCIPAL,
        });
        expect(statement?.Condition?.StringEquals?.["aws:SourceAccount"]).toBe(
          ACCOUNT,
        );
      });

      it("allows the log delivery service to write log objects", () => {
        const template = synth();
        const [logicalId] = findBucket(template, { waf: true });
        const statement = statementBySid(
          findPolicyStatements(template, logicalId),
          "AWSLogDeliveryWrite",
        );
        expect(statement).toBeDefined();
        expect(statement?.Effect).toBe("Allow");
        expect(statement?.Action).toBe("s3:PutObject");
        expect(statement?.Principal).toEqual({
          Service: LOG_DELIVERY_SERVICE_PRINCIPAL,
        });
        expect(statement?.Condition?.StringEquals?.["s3:x-amz-acl"]).toBe(
          "bucket-owner-full-control",
        );
        expect(statement?.Condition?.StringEquals?.["aws:SourceAccount"]).toBe(
          ACCOUNT,
        );
        expect(statement?.Condition?.ArnLike?.["aws:SourceArn"]).toBeDefined();
      });

      it("orders the logging configuration after the bucket policy", () => {
        const template = synth();
        const [bucketLogicalId] = findBucket(template, { waf: true });
        const policyLogicalId = Object.entries(
          template.findResources("AWS::S3::BucketPolicy"),
        ).find(
          ([, resource]) =>
            ((resource as ResourceEntry).Properties.Bucket as { Ref?: string })
              ?.Ref === bucketLogicalId,
        )?.[0];
        expect(policyLogicalId).toBeDefined();
        const loggingConfigs = Object.values(
          template.findResources("AWS::WAFv2::LoggingConfiguration"),
        );
        expect(loggingConfigs).toHaveLength(1);
        expect(
          (loggingConfigs[0] as { DependsOn?: string[] }).DependsOn,
        ).toContain(policyLogicalId);
      });

      it("declares no log delivery statements on the CloudFront log bucket", () => {
        const template = synth();
        const [logicalId] = findBucket(template);
        const statements = findPolicyStatements(template, logicalId);
        expect(
          statements.filter(
            (statement) =>
              statement.Principal?.Service === LOG_DELIVERY_SERVICE_PRINCIPAL,
          ),
        ).toHaveLength(0);
      });
    });

    describe("Error Conditions", () => {
      it("rejects a logRetention that is not a positive whole number of days", () => {
        expect(() => synth({ logRetention: 0 })).toThrow(ConfigurationError);
        expect(() => synth({ logRetention: -1 })).toThrow(ConfigurationError);
        expect(() => synth({ logRetention: 1.5 })).toThrow(ConfigurationError);
      });
    });
  });

  describe("Features", () => {
    it("creates no auto-delete custom resource at all for JaypieDistribution", () => {
      const template = synthDistribution();
      expect(
        Object.keys(template.findResources("Custom::S3AutoDeleteObjects")),
      ).toHaveLength(0);
    });
  });
});
