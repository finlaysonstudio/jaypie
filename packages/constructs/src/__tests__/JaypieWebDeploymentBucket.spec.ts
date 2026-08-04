import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import { JaypieWebDeploymentBucket } from "../JaypieWebDeploymentBucket";

function findBucketNames(template: Template) {
  return Object.values(template.findResources("AWS::S3::Bucket")).map(
    (bucket) => bucket.Properties?.BucketName,
  );
}

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

    it("creates distribution, headers, and log bucket with host+zone", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.distribution).toBeDefined();
      expect(construct.responseHeadersPolicy).toBeDefined();
      expect(construct.logBucket).toBeDefined();
      expect(construct.webAcl).toBeUndefined();
      expect(construct.wafLogBucket).toBeUndefined();

      template.hasResource("AWS::CloudFront::Distribution", {});
      template.hasResource("AWS::CloudFront::ResponseHeadersPolicy", {});
      template.resourceCountIs("AWS::WAFv2::WebACL", 0);
      template.resourceCountIs("AWS::WAFv2::LoggingConfiguration", 0);
    });

    it("creates WAF with host+zone and waf: true", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        waf: true,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.webAcl).toBeDefined();
      expect(construct.wafLogBucket).toBeDefined();

      template.hasResource("AWS::WAFv2::WebACL", {});
      template.hasResource("AWS::WAFv2::LoggingConfiguration", {});
    });
  });

  describe("Bucket Name", () => {
    it("defaults to the web component", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const stack = new Stack();

      new JaypieWebDeploymentBucket(stack, "Web");
      const template = Template.fromStack(stack);

      expect(findBucketNames(template)).toEqual([
        "sandbox-cloudagent-web-ckujet",
      ]);
    });

    it("names the bucket from component", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const stack = new Stack();

      new JaypieWebDeploymentBucket(stack, "App", { component: "app" });
      const template = Template.fromStack(stack);

      expect(findBucketNames(template)).toEqual([
        "sandbox-cloudagent-app-ckujet",
      ]);
    });

    it("gives two instances distinct names when component is set", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const stack = new Stack();

      new JaypieWebDeploymentBucket(stack, "Web");
      new JaypieWebDeploymentBucket(stack, "App", { component: "app" });
      const template = Template.fromStack(stack);

      expect(findBucketNames(template)).toEqual([
        "sandbox-cloudagent-web-ckujet",
        "sandbox-cloudagent-app-ckujet",
      ]);
    });

    it("honors an explicit name over component", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const stack = new Stack();

      new JaypieWebDeploymentBucket(stack, "App", {
        component: "app",
        name: "explicit-name",
      });
      const template = Template.fromStack(stack);

      expect(findBucketNames(template)).toEqual(["explicit-name"]);
    });

    it("ignores host.component for the bucket name", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Surface", {
        host: { component: "app", domain: "example.com" },
        zone,
      });
      const template = Template.fromStack(stack);

      expect(findBucketNames(template)).toContain(
        "sandbox-cloudagent-web-ckujet",
      );
    });
  });

  describe("Cache Behaviors", () => {
    it("caches at the edge in production without a catch-all behavior", () => {
      process.env.PROJECT_ENV = "production";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
        cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
      );
      expect(config.CacheBehaviors).toBeUndefined();
    });

    it("disables caching outside production", () => {
      process.env.PROJECT_ENV = "sandbox";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
        cloudfront.CachePolicy.CACHING_DISABLED.cachePolicyId,
      );
      expect(config.CacheBehaviors).toBeUndefined();
    });

    it("keeps behaviors added after construction reachable in production", () => {
      process.env.PROJECT_ENV = "production";
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      construct.distribution!.addBehavior(
        "/app/*",
        new origins.HttpOrigin("origin.example.com"),
      );
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      const patterns = (
        config.CacheBehaviors as Array<{ PathPattern: string }>
      ).map((behavior) => behavior.PathPattern);
      expect(patterns).toEqual(["/app/*"]);
    });
  });

  describe("Default Behavior Override", () => {
    it("attaches functionAssociations to the default behavior", () => {
      const { stack, zone } = makeStack();
      const rewrite = new cloudfront.Function(stack, "Rewrite", {
        code: cloudfront.FunctionCode.fromInline(
          "function handler(event) { return event.request; }",
        ),
      });

      new JaypieWebDeploymentBucket(stack, "Web", {
        defaultBehavior: {
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: rewrite,
            },
          ],
        },
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.FunctionAssociations).toEqual([
        {
          EventType: "viewer-request",
          FunctionARN: {
            "Fn::GetAtt": [expect.any(String), "FunctionARN"],
          },
        },
      ]);
      expect(config.CacheBehaviors).toBeUndefined();
    });

    it("keeps construct defaults the override does not name", () => {
      process.env.PROJECT_ENV = "production";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        defaultBehavior: {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
        cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
      );
      expect(config.DefaultCacheBehavior.ResponseHeadersPolicyId).toBeDefined();
      expect(config.DefaultCacheBehavior.AllowedMethods).toEqual(
        cloudfront.AllowedMethods.ALLOW_ALL.methods,
      );
    });

    it("lets the override win over a construct default", () => {
      process.env.PROJECT_ENV = "production";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        defaultBehavior: {
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
        cloudfront.CachePolicy.CACHING_DISABLED.cachePolicyId,
      );
    });

    it("accepts an origin override", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        defaultBehavior: {
          origin: new origins.HttpOrigin("origin.example.com"),
        },
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      const domains = (config.Origins as Array<{ DomainName: unknown }>).map(
        (origin) => origin.DomainName,
      );
      expect(domains).toEqual(["origin.example.com"]);
    });
  });

  describe("SPA", () => {
    it("creates no CloudFront Function by default", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.spaFunction).toBeUndefined();
      template.resourceCountIs("AWS::CloudFront::Function", 0);
    });

    it("attaches a viewer-request rewrite to the default behavior", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        spa: true,
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      expect(construct.spaFunction).toBeDefined();
      template.resourceCountIs("AWS::CloudFront::Function", 1);
      expect(config.DefaultCacheBehavior.FunctionAssociations).toEqual([
        {
          EventType: "viewer-request",
          FunctionARN: {
            "Fn::GetAtt": [expect.any(String), "FunctionARN"],
          },
        },
      ]);
      expect(config.CacheBehaviors).toBeUndefined();
    });

    it("names the function from component", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "cloudagent";
      process.env.PROJECT_NONCE = "ckujet";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "App", {
        component: "app",
        host: "app.example.com",
        spa: true,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties("AWS::CloudFront::Function", {
          Name: "sandbox-cloudagent-app-spa-ckujet",
        }),
      ).not.toThrow();
    });

    it("rewrites extensionless paths to index.html", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        spa: true,
        zone,
      });
      const template = Template.fromStack(stack);
      const functions = template.findResources("AWS::CloudFront::Function");
      const code = Object.values(functions)[0].Properties.FunctionCode;

      const handler = new Function(`${code}; return handler;`)();
      const rewrite = (uri: string) =>
        handler({ request: { uri } }).uri as string;

      expect(rewrite("/")).toBe("/index.html");
      expect(rewrite("/jobs")).toBe("/index.html");
      expect(rewrite("/jobs/")).toBe("/index.html");
      expect(rewrite("/jobs/42")).toBe("/index.html");
      expect(rewrite("/assets/index-a1b2c3.js")).toBe(
        "/assets/index-a1b2c3.js",
      );
      expect(rewrite("/favicon.ico")).toBe("/favicon.ico");
      expect(rewrite("/index.html")).toBe("/index.html");
    });

    it("appends the rewrite after caller functionAssociations", () => {
      const { stack, zone } = makeStack();
      const custom = new cloudfront.Function(stack, "Custom", {
        code: cloudfront.FunctionCode.fromInline(
          "function handler(event) { return event.response; }",
        ),
      });

      new JaypieWebDeploymentBucket(stack, "Web", {
        defaultBehavior: {
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
              function: custom,
            },
          ],
        },
        host: "app.example.com",
        spa: true,
        zone,
      });
      const template = Template.fromStack(stack);
      const config = findDistribution(template).Properties.DistributionConfig;

      const eventTypes = (
        config.DefaultCacheBehavior.FunctionAssociations as Array<{
          EventType: string;
        }>
      ).map((association) => association.EventType);
      expect(eventTypes).toEqual(["viewer-response", "viewer-request"]);
    });

    it("throws when the caller already associates a viewer-request function", () => {
      const { stack, zone } = makeStack();
      const custom = new cloudfront.Function(stack, "Custom", {
        code: cloudfront.FunctionCode.fromInline(
          "function handler(event) { return event.request; }",
        ),
      });

      expect(() => {
        new JaypieWebDeploymentBucket(stack, "Web", {
          defaultBehavior: {
            functionAssociations: [
              {
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                function: custom,
              },
            ],
          },
          host: "app.example.com",
          spa: true,
          zone,
        });
      }).toThrow(ConfigurationError);
    });

    it("creates no function without a distribution", () => {
      const stack = new Stack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        spa: true,
      });
      const template = Template.fromStack(stack);

      expect(construct.spaFunction).toBeUndefined();
      template.resourceCountIs("AWS::CloudFront::Function", 0);
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
    it("creates a WebACL named after the construct id with waf: true", () => {
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "MyWeb", {
        host: "app.example.com",
        waf: true,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties("AWS::WAFv2::WebACL", {
          Name: Match.stringLikeRegexp("MyWeb-WebAcl"),
        }),
      ).not.toThrow();
    });

    it("creates no WebACL by default", () => {
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.webAcl).toBeUndefined();
      template.resourceCountIs("AWS::WAFv2::WebACL", 0);
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

    it("throws ConfigurationError when managedRuleOverrides names an unknown rule (#362)", () => {
      const { stack, zone } = makeStack();
      expect(() => {
        new JaypieWebDeploymentBucket(stack, "Web", {
          host: "app.example.com",
          zone,
          waf: {
            managedRuleOverrides: {
              AWSManagedRulesCommonRuleSet: [
                { name: "NotARealRule", actionToUse: { count: {} } },
              ],
            },
          },
        });
      }).toThrow(ConfigurationError);
    });

    it("truncates long WAF log bucket names to 63 chars while preserving nonce", () => {
      process.env.PROJECT_ENV = "development";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "598eea56";
      const { stack, zone } = makeStack();

      new JaypieWebDeploymentBucket(stack, "DocumentationBucket", {
        host: "app.example.com",
        waf: true,
        zone,
      });
      const template = Template.fromStack(stack);

      const buckets = template.findResources("AWS::S3::Bucket");
      const wafLogBucket = Object.values(buckets).find((bucket) => {
        const name = bucket.Properties?.BucketName;
        return typeof name === "string" && name.startsWith("aws-waf-logs-");
      });

      expect(wafLogBucket).toBeDefined();
      const name = wafLogBucket!.Properties.BucketName as string;
      expect(name.length).toBeLessThanOrEqual(63);
      expect(name.startsWith("aws-waf-logs-")).toBe(true);
      expect(name.endsWith("-598eea56")).toBe(true);
      expect(name).not.toMatch(/-+$/);
      expect(name).not.toMatch(/--/);
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
      // DestinationBucket + access LogBucket
      template.resourceCountIs("AWS::S3::Bucket", 2);
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

  describe("exportOutputs", () => {
    it("emits stack-level outputs with stable logical IDs", () => {
      process.env.CDK_ENV_REPO = "owner/repo";
      const { stack, zone } = makeStack();

      const construct = new JaypieWebDeploymentBucket(stack, "Web", {
        host: "app.example.com",
        zone,
      });
      construct.exportOutputs();

      const template = Template.fromStack(stack);
      const outputs = template.findOutputs("*");
      const ids = Object.keys(outputs);

      expect(ids).toContain("DestinationBucketName");
      expect(ids).toContain("DestinationBucketDeployRoleArn");
      expect(ids).toContain("DistributionId");
      expect(ids).toContain("CertificateArn");
    });

    it("skips outputs whose underlying resources do not exist", () => {
      const stack = new Stack();
      const construct = new JaypieWebDeploymentBucket(stack, "Web");
      construct.exportOutputs();

      const template = Template.fromStack(stack);
      const ids = Object.keys(template.findOutputs("*"));

      expect(ids).toContain("DestinationBucketName");
      expect(ids).not.toContain("DestinationBucketDeployRoleArn");
      expect(ids).not.toContain("DistributionId");
      expect(ids).not.toContain("CertificateArn");
    });

    it("prefixes logical IDs to avoid collisions for multi-instance stacks", () => {
      process.env.CDK_ENV_REPO = "owner/repo";
      const { stack, zone } = makeStack();

      const a = new JaypieWebDeploymentBucket(stack, "A", {
        host: "a.example.com",
        zone,
      });
      const b = new JaypieWebDeploymentBucket(stack, "B", {
        host: "b.example.com",
        zone,
      });
      a.exportOutputs({ prefix: "A" });
      b.exportOutputs({ prefix: "B" });

      const template = Template.fromStack(stack);
      const ids = Object.keys(template.findOutputs("*"));

      expect(ids).toContain("ADestinationBucketName");
      expect(ids).toContain("BDestinationBucketName");
      expect(ids).toContain("ADistributionId");
      expect(ids).toContain("BDistributionId");
    });

    it("returns the constructed outputs keyed by logical ID", () => {
      const stack = new Stack();
      const construct = new JaypieWebDeploymentBucket(stack, "Web");

      const result = construct.exportOutputs();

      expect(result.DestinationBucketName).toBeDefined();
      expect(result.DestinationBucketDeployRoleArn).toBeUndefined();
    });
  });
});
