import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import { JaypieWebDeploymentBucket } from "../JaypieWebDeploymentBucket";

function findDistribution(template: Template) {
  const resources = template.findResources("AWS::CloudFront::Distribution");
  return Object.values(resources)[0];
}

function makeStack() {
  const stack = new Stack(undefined, "Stack", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const zone = new route53.HostedZone(stack, "Zone", {
    zoneName: "example.com",
  });
  return { stack, zone };
}

describe("JaypieWebDeploymentBucket", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_WEB_HOST;
    delete process.env.CDK_ENV_WEB_HOSTED_ZONE;
    delete process.env.CDK_ENV_WEB_SUBDOMAIN;
    delete process.env.CDK_ENV_REPO;
    delete process.env.PROJECT_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieWebDeploymentBucket).toBeFunction();
    });

    it("creates only an S3 bucket without host/zone", () => {
      const stack = new Stack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web");
      const template = Template.fromStack(stack);

      expect(construct.bucket).toBeDefined();
      expect(construct.distribution).toBeUndefined();
      expect(construct.responseHeadersPolicy).toBeUndefined();
      expect(construct.webAcl).toBeUndefined();
      expect(construct.logBucket).toBeUndefined();
      template.hasResource("AWS::S3::Bucket", {});
      template.resourceCountIs("AWS::CloudFront::Distribution", 0);
      template.resourceCountIs("AWS::WAFv2::WebACL", 0);
    });

    it("creates distribution, headers, log bucket, and WAF with host+zone", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.distribution).toBeDefined();
      expect(construct.responseHeadersPolicy).toBeDefined();
      expect(construct.logBucket).toBeDefined();
      expect(construct.webAcl).toBeDefined();
      expect(construct.wafLogBucket).toBeDefined();

      template.hasResource("AWS::CloudFront::Distribution", {});
      template.hasResource("AWS::CloudFront::ResponseHeadersPolicy", {});
      template.hasResource("AWS::WAFv2::WebACL", {});
      template.hasResource("AWS::WAFv2::LoggingConfiguration", {});
    });
  });

  describe("Security Headers", () => {
    it("attaches default ResponseHeadersPolicy to default behavior", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const distribution = findDistribution(template);

      expect(
        distribution.Properties.DistributionConfig.DefaultCacheBehavior
          .ResponseHeadersPolicyId,
      ).toBeDefined();
    });

    it("disables security headers when securityHeaders is false", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        securityHeaders: false,
      });
      const template = Template.fromStack(stack);

      expect(construct.responseHeadersPolicy).toBeUndefined();
      template.resourceCountIs("AWS::CloudFront::ResponseHeadersPolicy", 0);
    });

    it("merges securityHeaders overrides with defaults", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        securityHeaders: {
          contentSecurityPolicy: "default-src 'self';",
          frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
        },
      });
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties(
          "AWS::CloudFront::ResponseHeadersPolicy",
          {
            ResponseHeadersPolicyConfig: {
              SecurityHeadersConfig: {
                ContentSecurityPolicy: {
                  ContentSecurityPolicy: "default-src 'self';",
                },
                FrameOptions: {
                  FrameOption: "SAMEORIGIN",
                },
              },
            },
          },
        ),
      ).not.toThrow();
    });

    it("uses responseHeadersPolicy override and skips default policy", () => {
      const { stack, zone } = makeStack();

      const customPolicy = new cloudfront.ResponseHeadersPolicy(
        stack,
        "CustomPolicy",
        {
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
          },
        },
      );

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        responseHeadersPolicy: customPolicy,
      });

      expect(construct.responseHeadersPolicy).toBe(customPolicy);
    });
  });

  describe("WAF", () => {
    it("creates a WebACL named after the construct id by default", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "MyWeb", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties("AWS::WAFv2::WebACL", {
          Name: Match.stringLikeRegexp("MyWeb-WebAcl"),
        }),
      ).not.toThrow();
    });

    it("disables WAF when waf is false", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        waf: false,
      });
      const template = Template.fromStack(stack);

      expect(construct.webAcl).toBeUndefined();
      template.resourceCountIs("AWS::WAFv2::WebACL", 0);
    });

    it("respects custom waf.name and rateLimitPerIp", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        waf: { name: "custom", rateLimitPerIp: 500 },
      });
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties("AWS::WAFv2::WebACL", {
          Name: Match.stringLikeRegexp("custom-WebAcl"),
          Rules: Match.arrayWith([
            Match.objectLike({
              Name: "RateLimitPerIp",
              Statement: {
                RateBasedStatement: Match.objectLike({ Limit: 500 }),
              },
            }),
          ]),
        }),
      ).not.toThrow();
    });

    it("disables WAF logging when waf.logBucket is false", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        waf: { logBucket: false },
      });
      const template = Template.fromStack(stack);

      expect(construct.wafLogBucket).toBeUndefined();
      template.resourceCountIs("AWS::WAFv2::LoggingConfiguration", 0);
    });

    it("attaches an existing WebACL ARN", () => {
      const { stack, zone } = makeStack();
      const externalArn =
        "arn:aws:wafv2:us-east-1:111111111111:global/webacl/external/abc";

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        waf: { webAclArn: externalArn },
      });
      const template = Template.fromStack(stack);

      expect(construct.webAcl).toBeUndefined();
      template.resourceCountIs("AWS::WAFv2::WebACL", 0);
      const distribution = findDistribution(template);
      expect(distribution.Properties.DistributionConfig.WebACLId).toBe(
        externalArn,
      );
    });
  });

  describe("HostConfig", () => {
    it("resolves host from a HostConfig object via envHostname", () => {
      process.env.PROJECT_ENV = "production";
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: { subdomain: "app", domain: "example.com" },
        zone,
      });
      const template = Template.fromStack(stack);
      const distribution = findDistribution(template);

      expect(construct.distribution).toBeDefined();
      expect(distribution.Properties.DistributionConfig.Aliases).toEqual([
        "app.example.com",
      ]);
    });

    it("includes env in non-production HostConfig hosts", () => {
      process.env.PROJECT_ENV = "sandbox";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: { subdomain: "app", domain: "example.com" },
        zone,
      });
      const template = Template.fromStack(stack);
      const distribution = findDistribution(template);

      expect(distribution.Properties.DistributionConfig.Aliases).toEqual([
        "app.sandbox.example.com",
      ]);
    });
  });

  describe("Access Logging", () => {
    it("creates an access log bucket by default", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.logBucket).toBeDefined();
      // DestinationBucket + access LogBucket + WafLogBucket
      template.resourceCountIs("AWS::S3::Bucket", 3);
    });

    it("skips creating an access log bucket when destination is false", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        destination: false,
        waf: false,
      });

      expect(construct.logBucket).toBeUndefined();
    });

    it("uses an external IBucket when provided as logBucket", () => {
      const { stack, zone } = makeStack();
      const externalBucket = new s3.Bucket(stack, "External");

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
        logBucket: externalBucket,
      });

      expect(construct.logBucket).toBe(externalBucket);
    });
  });
});
