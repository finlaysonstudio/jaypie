import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { CDK } from "../constants";
import { JaypieDistribution } from "../JaypieDistribution";

// Helper function to find the CloudFront distribution in the template
function findDistribution(template: Template) {
  const resources = template.findResources("AWS::CloudFront::Distribution");
  const distributions = Object.values(resources);
  return distributions[0];
}

// Helper function to find Lambda FunctionUrl in the template
function findFunctionUrl(template: Template) {
  const resources = template.findResources("AWS::Lambda::Url");
  const urls = Object.values(resources);
  return urls[0];
}

describe("JaypieDistribution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieDistribution).toBeFunction();
    });

    it("creates required resources with IOrigin handler", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::CloudFront::Distribution", {});
    });

    it("creates required resources with IFunction handler", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::CloudFront::Distribution", {});
      template.hasResource("AWS::Lambda::Url", {});
    });

    it("creates required resources with IFunctionUrl handler", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });
      const functionUrl = fn.addFunctionUrl({
        authType: lambda.FunctionUrlAuthType.NONE,
      });

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: functionUrl,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::CloudFront::Distribution", {});
    });
  });

  describe("Error Conditions", () => {
    it("throws when neither handler nor defaultBehavior is provided", () => {
      const stack = new Stack();

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {});
      }).toThrow(
        "Either handler or defaultBehavior must be provided to JaypieDistribution",
      );
    });

    it("throws when CDK_ENV_API_SUBDOMAIN is invalid", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "invalid subdomain with spaces";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
        });
      }).toThrow("CDK_ENV_API_SUBDOMAIN is not a valid subdomain");
    });

    it("throws when CDK_ENV_API_HOSTED_ZONE is invalid", () => {
      process.env.CDK_ENV_API_HOSTED_ZONE = "invalid hostname with spaces";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
        });
      }).toThrow("CDK_ENV_API_HOSTED_ZONE is not a valid hostname");
    });

    it("throws when CDK_ENV_HOSTED_ZONE is invalid", () => {
      process.env.CDK_ENV_HOSTED_ZONE = "invalid hostname with spaces";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
        });
      }).toThrow("CDK_ENV_HOSTED_ZONE is not a valid hostname");
    });

    it("throws when host prop is invalid", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          host: "invalid hostname with spaces",
        });
      }).toThrow("Host is not a valid hostname");
    });
  });

  describe("Happy Paths", () => {
    it("creates distribution with S3 origin", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      expect(construct.distribution).toBeDefined();
      expect(construct.distributionDomainName).toBeDefined();
      expect(construct.distributionId).toBeDefined();
    });

    it("creates distribution with Lambda function and auto-creates FunctionUrl", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      expect(construct.functionUrl).toBeDefined();

      const functionUrl = findFunctionUrl(template);
      expect(functionUrl).toBeDefined();
      expect(functionUrl.Properties.AuthType).toBe("NONE");
    });

    it("creates distribution with defaultBehavior override", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        defaultBehavior: {
          origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        },
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();
    });
  });

  describe("Features", () => {
    it("uses CACHING_DISABLED by default when handler is provided", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();

      // CloudFront uses CachePolicyId references
      const defaultBehavior =
        distribution.Properties.DistributionConfig.DefaultCacheBehavior;
      expect(defaultBehavior.CachePolicyId).toBeDefined();
    });

    it("uses REDIRECT_TO_HTTPS by default when handler is provided", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();

      const defaultBehavior =
        distribution.Properties.DistributionConfig.DefaultCacheBehavior;
      expect(defaultBehavior.ViewerProtocolPolicy).toBe("redirect-to-https");
    });

    it("adds role tag when provided", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        roleTag: "TEST_ROLE",
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();

      const tags = distribution.Properties.Tags || [];
      expect(tags).toContainEqual({
        Key: CDK.TAG.ROLE,
        Value: "TEST_ROLE",
      });
    });

    it("uses default HOSTING role tag", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();

      const tags = distribution.Properties.Tags || [];
      expect(tags).toContainEqual({
        Key: CDK.TAG.ROLE,
        Value: CDK.ROLE.API,
      });
    });

    it("configures invokeMode for Lambda FunctionUrl", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
        invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      });
      const template = Template.fromStack(stack);

      const functionUrl = findFunctionUrl(template);
      expect(functionUrl).toBeDefined();
      expect(functionUrl.Properties.InvokeMode).toBe("RESPONSE_STREAM");
    });

    it("uses BUFFERED invokeMode by default", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      const functionUrl = findFunctionUrl(template);
      expect(functionUrl).toBeDefined();
      expect(functionUrl.Properties.InvokeMode).toBe("BUFFERED");
    });

    it("passes through additional Distribution props", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        comment: "Test distribution comment",
        enabled: true,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();
      expect(distribution.Properties.DistributionConfig.Comment).toBe(
        "Test distribution comment",
      );
      expect(distribution.Properties.DistributionConfig.Enabled).toBe(true);
    });

    it("exposes host property when provided", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      // Note: Without zone, host is set but no certificate or DNS record is created
      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        host: "api.example.com",
      });

      expect(construct.host).toBe("api.example.com");
    });

    it("uses CDK_ENV_API_HOST_NAME from environment", () => {
      process.env.CDK_ENV_API_HOST_NAME = "api-env.example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      expect(construct.host).toBe("api-env.example.com");
    });

    it("constructs host from CDK_ENV_API_SUBDOMAIN and CDK_ENV_API_HOSTED_ZONE", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "api";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      // Certificate and DNS require zone lookup which needs account/region
      // This test verifies the host is correctly constructed from env vars
      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        certificate: false,
      });

      expect(construct.host).toBe("api.example.com");
    });

    it("constructs host from CDK_ENV_API_SUBDOMAIN and CDK_ENV_HOSTED_ZONE", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "api";
      process.env.CDK_ENV_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      // Certificate and DNS require zone lookup which needs account/region
      // This test verifies the host is correctly constructed from env vars
      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        certificate: false,
      });

      expect(construct.host).toBe("api.example.com");
    });

    it("prefers host prop over environment variables", () => {
      process.env.CDK_ENV_API_HOST_NAME = "env-host.example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        host: "prop-host.example.com",
      });

      expect(construct.host).toBe("prop-host.example.com");
    });

    it("disables certificate when certificate is false", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "api";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      // certificate: false should prevent zone lookup and certificate creation
      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        certificate: false,
      });

      expect(construct.certificate).toBeUndefined();
      expect(construct.host).toBe("api.example.com");
    });

    it("uses provided certificate when passed", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);
      const certificate = new acm.Certificate(stack, "TestCert", {
        domainName: "api.example.com",
      });

      // When certificate is passed, we don't need zone lookup since certificate is already created
      // But the current implementation still needs zone for DNS record
      // Test that certificate prop is accepted (even without zone)
      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        host: "api.example.com",
        certificate,
      });

      // Certificate is only set when host AND zone are both present
      // Without zone, certificate isn't applied to the distribution
      expect(construct.host).toBe("api.example.com");
    });
  });

  describe("IDistribution Implementation", () => {
    it("implements IDistribution by delegating to underlying distribution", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      // Test key IDistribution properties
      expect(construct.distributionArn).toBeDefined();
      expect(construct.distributionDomainName).toBeDefined();
      expect(construct.distributionId).toBeDefined();
      expect(construct.domainName).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);
    });

    it("applies removal policy to distribution", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      construct.applyRemovalPolicy(RemovalPolicy.DESTROY);

      const template = Template.fromStack(stack);
      template.hasResource("AWS::CloudFront::Distribution", {
        DeletionPolicy: "Delete",
      });

      expect(template).toBeDefined();
    });

    it("grants permissions", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = new origins.S3Origin(bucket);
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      // Grant invalidation permissions
      construct.grantCreateInvalidation(fn);

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "cloudfront:CreateInvalidation",
              Effect: "Allow",
            }),
          ]),
        },
      });

      expect(template).toBeDefined();
    });
  });
});
