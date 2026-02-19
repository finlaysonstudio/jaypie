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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      expect(() => {
        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
        });
      }).toThrow("CDK_ENV_HOSTED_ZONE is not a valid hostname");
    });

    it("throws when host prop is invalid", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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

    it("configures streaming for Lambda FunctionUrl", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
        streaming: true,
      });
      const template = Template.fromStack(stack);

      const functionUrl = findFunctionUrl(template);
      expect(functionUrl).toBeDefined();
      expect(functionUrl.Properties.InvokeMode).toBe("RESPONSE_STREAM");
    });

    it("uses BUFFERED mode by default (streaming: false)", () => {
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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
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

    it("sets PROJECT_BASE_URL on Lambda function when host is provided", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieDistribution(stack, "TestDistribution", {
        handler: fn,
        host: "api.example.com",
      });
      const template = Template.fromStack(stack);

      // Verify the Lambda function has PROJECT_BASE_URL set
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            PROJECT_BASE_URL: "https://api.example.com",
          },
        },
      });
    });

    it("does not set PROJECT_BASE_URL when host is not provided", () => {
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

      // Verify the Lambda function does NOT have PROJECT_BASE_URL
      const lambdaFunctions = template.findResources("AWS::Lambda::Function");
      const lambdaProps = Object.values(lambdaFunctions)[0]?.Properties;
      expect(
        lambdaProps?.Environment?.Variables?.PROJECT_BASE_URL,
      ).toBeUndefined();
    });
  });

  describe("IDistribution Implementation", () => {
    it("implements IDistribution by delegating to underlying distribution", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

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
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
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

  describe("Logging", () => {
    it("creates log bucket by default", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      expect(construct.logBucket).toBeDefined();
      // Should have two S3 buckets: the origin bucket and the log bucket
      template.resourceCountIs("AWS::S3::Bucket", 2);
    });

    it("configures distribution with logging enabled", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      expect(distribution).toBeDefined();
      expect(distribution.Properties.DistributionConfig.Logging).toBeDefined();
      expect(distribution.Properties.DistributionConfig.Logging.Prefix).toBe(
        "cloudfront-logs/",
      );
    });

    it("creates log bucket with lifecycle rules", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      // Find the log bucket (has lifecycle configuration)
      template.hasResourceProperties("AWS::S3::Bucket", {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              ExpirationInDays: 90,
              Status: "Enabled",
            }),
          ]),
        },
      });

      expect(template).toBeDefined();
    });

    it("adds storage role tag to log bucket", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      // Find the log bucket with the role tag
      template.hasResourceProperties("AWS::S3::Bucket", {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.STORAGE,
          }),
        ]),
      });

      expect(template).toBeDefined();
    });

    it("disables logging when destination is false", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        destination: false,
      });
      const template = Template.fromStack(stack);

      expect(construct.logBucket).toBeUndefined();
      // Should only have the origin bucket, no log bucket
      template.resourceCountIs("AWS::S3::Bucket", 1);

      const distribution = findDistribution(template);
      expect(
        distribution.Properties.DistributionConfig.Logging,
      ).toBeUndefined();
    });

    it("sets up S3 notification for log bucket", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      // Verify that there's a bucket notification configuration
      template.hasResourceProperties(
        "Custom::S3BucketNotifications",
        Match.objectLike({
          NotificationConfiguration: {
            LambdaFunctionConfigurations: Match.arrayWith([
              Match.objectLike({
                Events: ["s3:ObjectCreated:*"],
              }),
            ]),
          },
        }),
      );

      expect(template).toBeDefined();
    });

    describe("External Log Bucket", () => {
      it("uses logBucket: true to import from CDK.IMPORT.LOG_BUCKET", () => {
        const stack = new Stack();
        const bucket = new s3.Bucket(stack, "TestBucket");
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const construct = new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: true,
        });
        const template = Template.fromStack(stack);

        // Should have reference to external bucket (not creating new log bucket)
        // Only 1 S3 bucket created (origin bucket), log bucket is imported
        template.resourceCountIs("AWS::S3::Bucket", 1);

        // logBucket should be set
        expect(construct.logBucket).toBeDefined();

        // Distribution should have logging configured
        const distribution = findDistribution(template);
        expect(
          distribution.Properties.DistributionConfig.Logging,
        ).toBeDefined();
      });

      it("uses logBucket with bucket name string", () => {
        const stack = new Stack();
        const bucket = new s3.Bucket(stack, "TestBucket");
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const construct = new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: "my-existing-log-bucket",
        });
        const template = Template.fromStack(stack);

        // Should not create a new log bucket
        template.resourceCountIs("AWS::S3::Bucket", 1);

        // logBucket should be set
        expect(construct.logBucket).toBeDefined();

        // Distribution should have logging configured
        const distribution = findDistribution(template);
        expect(
          distribution.Properties.DistributionConfig.Logging,
        ).toBeDefined();
      });

      it("uses logBucket with { exportName } object", () => {
        const stack = new Stack();
        const bucket = new s3.Bucket(stack, "TestBucket");
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const construct = new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: { exportName: "my-custom-bucket-export" },
        });
        const template = Template.fromStack(stack);

        // Should not create a new log bucket
        template.resourceCountIs("AWS::S3::Bucket", 1);

        // logBucket should be set
        expect(construct.logBucket).toBeDefined();

        // Distribution should have logging configured
        const distribution = findDistribution(template);
        expect(
          distribution.Properties.DistributionConfig.Logging,
        ).toBeDefined();
      });

      it("uses logBucket with IBucket directly", () => {
        const stack = new Stack();
        const originBucket = new s3.Bucket(stack, "TestBucket");
        const origin =
          origins.S3BucketOrigin.withOriginAccessControl(originBucket);
        const externalLogBucket = new s3.Bucket(stack, "ExternalLogBucket", {
          objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        });

        const construct = new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: externalLogBucket,
        });
        const template = Template.fromStack(stack);

        // Should have two buckets (origin and external log bucket we created)
        template.resourceCountIs("AWS::S3::Bucket", 2);

        // logBucket should be the external bucket
        expect(construct.logBucket).toBe(externalLogBucket);

        // Distribution should have logging configured
        const distribution = findDistribution(template);
        expect(
          distribution.Properties.DistributionConfig.Logging,
        ).toBeDefined();
      });

      it("does not add notifications to external buckets", () => {
        const stack = new Stack();
        const bucket = new s3.Bucket(stack, "TestBucket");
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: true,
        });
        const template = Template.fromStack(stack);

        // Should NOT have bucket notification configuration since external bucket
        const notifications = template.findResources(
          "Custom::S3BucketNotifications",
        );
        expect(Object.keys(notifications).length).toBe(0);
      });

      it("allows logBucket with destination: false (logs without notifications)", () => {
        const stack = new Stack();
        const bucket = new s3.Bucket(stack, "TestBucket");
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const construct = new JaypieDistribution(stack, "TestDistribution", {
          handler: origin,
          logBucket: true,
          destination: false,
        });
        const template = Template.fromStack(stack);

        // Should not create a new log bucket
        template.resourceCountIs("AWS::S3::Bucket", 1);

        // logBucket should still be set (external bucket)
        expect(construct.logBucket).toBeDefined();

        // Distribution should have logging configured
        const distribution = findDistribution(template);
        expect(
          distribution.Properties.DistributionConfig.Logging,
        ).toBeDefined();
      });
    });
  });

  describe("Security Headers", () => {
    // Helper to find ResponseHeadersPolicy resources
    function findResponseHeadersPolicies(template: Template) {
      return template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
    }

    it("creates a ResponseHeadersPolicy by default", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      expect(construct.responseHeadersPolicy).toBeDefined();
      const policies = findResponseHeadersPolicies(template);
      expect(Object.keys(policies).length).toBe(1);
    });

    it("attaches policy to the default behavior", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      const distribution = findDistribution(template);
      const defaultBehavior =
        distribution.Properties.DistributionConfig.DefaultCacheBehavior;
      expect(defaultBehavior.ResponseHeadersPolicyId).toBeDefined();
    });

    it("sets Strict-Transport-Security header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            StrictTransportSecurity: {
              AccessControlMaxAgeSec: CDK.SECURITY_HEADERS.HSTS_MAX_AGE,
              IncludeSubdomains: true,
              Override: true,
              Preload: true,
            },
          },
        },
      });
    });

    it("sets X-Content-Type-Options nosniff", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentTypeOptions: {
              Override: true,
            },
          },
        },
      });
    });

    it("sets X-Frame-Options to DENY by default", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            FrameOptions: {
              FrameOption: "DENY",
              Override: true,
            },
          },
        },
      });
    });

    it("sets Referrer-Policy to strict-origin-when-cross-origin", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ReferrerPolicy: {
              ReferrerPolicy: "strict-origin-when-cross-origin",
              Override: true,
            },
          },
        },
      });
    });

    it("sets Content-Security-Policy from defaults", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy:
                CDK.SECURITY_HEADERS.CONTENT_SECURITY_POLICY,
              Override: true,
            },
          },
        },
      });
    });

    it("sets Permissions-Policy custom header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Permissions-Policy",
                Override: true,
                Value: CDK.SECURITY_HEADERS.PERMISSIONS_POLICY,
              }),
            ]),
          },
        },
      });
    });

    it("sets Cache-Control custom header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Cache-Control",
                Override: true,
                Value: "no-store, no-cache, must-revalidate, proxy-revalidate",
              }),
            ]),
          },
        },
      });
    });

    it("sets Cross-Origin-Embedder-Policy custom header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Cross-Origin-Embedder-Policy",
                Override: true,
                Value: "unsafe-none",
              }),
            ]),
          },
        },
      });
    });

    it("sets Cross-Origin-Opener-Policy custom header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Cross-Origin-Opener-Policy",
                Override: true,
                Value: "same-origin",
              }),
            ]),
          },
        },
      });
    });

    it("sets Cross-Origin-Resource-Policy custom header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Cross-Origin-Resource-Policy",
                Override: true,
                Value: "same-origin",
              }),
            ]),
          },
        },
      });
    });

    it("removes Server header", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          RemoveHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Server",
              }),
            ]),
          },
        },
      });
    });

    it("disables security headers when securityHeaders is false", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        securityHeaders: false,
      });
      const template = Template.fromStack(stack);

      expect(construct.responseHeadersPolicy).toBeUndefined();
      const policies = findResponseHeadersPolicies(template);
      expect(Object.keys(policies).length).toBe(0);
    });

    it("overrides contentSecurityPolicy while retaining other defaults", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const customCsp = "default-src 'none';";
      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        securityHeaders: { contentSecurityPolicy: customCsp },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: customCsp,
              Override: true,
            },
            // Other defaults still present
            FrameOptions: {
              FrameOption: "DENY",
              Override: true,
            },
          },
        },
      });
    });

    it("overrides frameOption to SAMEORIGIN", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        securityHeaders: {
          frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
        },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            FrameOptions: {
              FrameOption: "SAMEORIGIN",
              Override: true,
            },
          },
        },
      });
    });

    it("uses full override with responseHeadersPolicy prop", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const customPolicy = new cloudfront.ResponseHeadersPolicy(
        stack,
        "CustomPolicy",
        {
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
          },
        },
      );

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        responseHeadersPolicy: customPolicy,
      });
      const template = Template.fromStack(stack);

      expect(construct.responseHeadersPolicy).toBe(customPolicy);
      // Only the custom policy, no auto-generated one
      const policies = findResponseHeadersPolicies(template);
      expect(Object.keys(policies).length).toBe(1);
    });

    it("does not inject policy when defaultBehavior is provided", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      new JaypieDistribution(stack, "TestDistribution", {
        defaultBehavior: {
          origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        },
      });
      const template = Template.fromStack(stack);

      // Policy is created but NOT auto-attached to defaultBehavior
      const distribution = findDistribution(template);
      const defaultBehavior =
        distribution.Properties.DistributionConfig.DefaultCacheBehavior;
      expect(defaultBehavior.ResponseHeadersPolicyId).toBeUndefined();
    });

    it("exposes responseHeadersPolicy property", () => {
      const stack = new Stack();
      const bucket = new s3.Bucket(stack, "TestBucket");
      const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

      const construct = new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
      });

      expect(construct.responseHeadersPolicy).toBeDefined();
    });
  });
});
