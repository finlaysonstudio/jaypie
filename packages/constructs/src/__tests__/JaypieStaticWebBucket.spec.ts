import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { CDK } from "../constants";
import { JaypieStaticWebBucket } from "../JaypieStaticWebBucket";

describe("JaypieStaticWebBucket", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env.CDK_ENV_DOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_SUBDOMAIN;
    delete process.env.CDK_ENV_REPO;
    delete process.env.PROJECT_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieStaticWebBucket).toBeFunction();
    });

    it("creates required resources with default props when env vars are set", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();

      // zone: undefined prevents hosted zone lookup which requires account/region
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::S3::Bucket", {});
    });
  });

  describe("Error Conditions", () => {
    it("throws when no domain is configured", () => {
      const stack = new Stack();

      expect(() => {
        new JaypieStaticWebBucket(stack);
      }).toThrow(
        "No hostname `domain` provided. Set CDK_ENV_DOMAIN or CDK_ENV_HOSTED_ZONE to use environment domain",
      );
    });
  });

  describe("Happy Paths", () => {
    it("creates bucket with static subdomain by default", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });

      expect(construct.bucket).toBeDefined();
      expect(construct.bucketName).toBeDefined();
    });

    it("uses constructEnvName('static') for bucket name", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      // The bucket name should contain "static"
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketName: Match.stringLikeRegexp("static"),
      });
    });
  });

  describe("Features", () => {
    it("allows custom id", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(
        stack,
        "JaypieStaticWebBucket-2",
        {
          zone: undefined,
        },
      );
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::S3::Bucket", {});
    });

    it("allows overriding host", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        host: "custom-static.example.com",
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::S3::Bucket", {});
    });

    it("allows overriding name", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        name: "custom-static-bucket",
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketName: "custom-static-bucket",
      });
    });

    it("allows overriding roleTag", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        roleTag: CDK.ROLE.STORAGE,
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.STORAGE,
          }),
        ]),
      });
    });

    it("uses HOSTING role tag by default", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.HOSTING,
          }),
        ]),
      });
    });

    it("passes through additional bucket props", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        versioned: true,
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });
    });

    it("creates deployment role when CDK_ENV_REPO is set", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";
      process.env.CDK_ENV_REPO = "org/repo";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });

      expect(construct.deployRoleArn).toBeDefined();
    });
  });

  describe("Specific Scenarios", () => {
    it("works with production environment", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "production";

      const stack = new Stack();
      const construct = new JaypieStaticWebBucket(stack, {
        zone: undefined,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::S3::Bucket", {});
    });

    it("uses CDK_ENV_DOMAIN for zone by default", () => {
      process.env.CDK_ENV_DOMAIN = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      // Not passing zone at all - should use CDK_ENV_DOMAIN
      // But this will fail because zone lookup requires account/region
      // So we verify the error message indicates hosted-zone lookup was attempted
      expect(() => {
        new JaypieStaticWebBucket(stack);
      }).toThrow("Cannot retrieve value from context provider hosted-zone");
    });

    it("uses CDK_ENV_HOSTED_ZONE as fallback for zone", () => {
      process.env.CDK_ENV_HOSTED_ZONE = "example.com";
      process.env.PROJECT_ENV = "development";

      const stack = new Stack();
      // Not passing zone at all - should use CDK_ENV_HOSTED_ZONE
      // This will fail because zone lookup requires account/region
      // So we verify the error message indicates hosted-zone lookup was attempted
      expect(() => {
        new JaypieStaticWebBucket(stack);
      }).toThrow("Cannot retrieve value from context provider hosted-zone");
    });
  });
});
