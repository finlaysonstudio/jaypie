import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as s3 from "aws-cdk-lib/aws-s3";

import { JaypieWebDeploymentBucket } from "../JaypieWebDeploymentBucket";

//
//
// Constants
//

const BLOCK_ACLS_ONLY = {
  BlockPublicAcls: true,
  BlockPublicPolicy: false,
  IgnorePublicAcls: true,
  RestrictPublicBuckets: false,
};

const BLOCK_ALL = {
  BlockPublicAcls: true,
  BlockPublicPolicy: true,
  IgnorePublicAcls: true,
  RestrictPublicBuckets: true,
};

//
//
// Helpers
//

function findDistribution(template: Template) {
  return Object.values(
    template.findResources("AWS::CloudFront::Distribution"),
  )[0];
}

function findSiteBucket(template: Template) {
  const buckets = template.findResources("AWS::S3::Bucket");
  const [bucket] = Object.entries(buckets)
    .filter(([logicalId]) => logicalId.startsWith("WebDestinationBucket"))
    .map(([, resource]) => resource);
  return bucket;
}

function synth(props = {}) {
  const stack = new Stack(undefined, "Stack", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const construct = new JaypieWebDeploymentBucket(stack, "Web", props);
  return { construct, template: Template.fromStack(stack) };
}

//
//
// Tests
//

describe("Issue #563: JaypieWebDeploymentBucket originAccessControl", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
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
    it("accepts the prop", () => {
      expect(() => synth({ originAccessControl: true })).not.toThrow();
    });
  });

  describe("Happy Paths", () => {
    it("blocks all public access on the site bucket", () => {
      const { template } = synth({ originAccessControl: true });

      expect(
        findSiteBucket(template).Properties.PublicAccessBlockConfiguration,
      ).toEqual(BLOCK_ALL);
    });

    it("creates no website configuration on the site bucket", () => {
      const { template } = synth({ originAccessControl: true });

      expect(
        findSiteBucket(template).Properties.WebsiteConfiguration,
      ).toBeUndefined();
    });

    it("creates an origin access control", () => {
      const { template } = synth({ originAccessControl: true });

      expect(
        Object.keys(
          template.findResources("AWS::CloudFront::OriginAccessControl"),
        ),
      ).toHaveLength(1);
      expect(() =>
        template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
          OriginAccessControlConfig: Match.objectLike({
            OriginAccessControlOriginType: "s3",
            SigningBehavior: "always",
            SigningProtocol: "sigv4",
          }),
        }),
      ).not.toThrow();
    });

    it("grants s3:GetObject to cloudfront.amazonaws.com", () => {
      const { template } = synth({ originAccessControl: true });

      expect(() =>
        template.hasResourceProperties("AWS::S3::BucketPolicy", {
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: "s3:GetObject",
                Effect: "Allow",
                Principal: { Service: "cloudfront.amazonaws.com" },
              }),
            ]),
          }),
        }),
      ).not.toThrow();
    });

    it("sets the distribution default root object to index.html", () => {
      const { template } = synth({ originAccessControl: true });

      expect(
        findDistribution(template).Properties.DistributionConfig
          .DefaultRootObject,
      ).toBe("index.html");
    });

    it("uses the REST endpoint, not the website endpoint, as the origin", () => {
      const { template } = synth({ originAccessControl: true });
      const [origin] =
        findDistribution(template).Properties.DistributionConfig.Origins;

      expect(origin.CustomOriginConfig).toBeUndefined();
      expect(origin.S3OriginConfig).toBeDefined();
      expect(origin.OriginAccessControlId).toBeDefined();
    });

    it("enforces SSL on the site bucket", () => {
      const { template } = synth({ originAccessControl: true });

      expect(() =>
        template.hasResourceProperties("AWS::S3::BucketPolicy", {
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Condition: { Bool: { "aws:SecureTransport": "false" } },
                Effect: "Deny",
              }),
            ]),
          }),
        }),
      ).not.toThrow();
    });

    it("still serves single-page app routes through the spa function", () => {
      const { construct, template } = synth({
        originAccessControl: true,
        spa: true,
      });
      const behavior =
        findDistribution(template).Properties.DistributionConfig
          .DefaultCacheBehavior;

      expect(construct.spaFunction).toBeDefined();
      expect(
        Object.keys(template.findResources("AWS::CloudFront::Function")),
      ).toHaveLength(1);
      expect(behavior.FunctionAssociations).toHaveLength(1);
      expect(behavior.FunctionAssociations[0].EventType).toBe("viewer-request");
      expect(behavior.FunctionAssociations[0].FunctionARN).toBeDefined();
    });
  });

  describe("Features", () => {
    describe("Backward compatibility", () => {
      it("defaults to the public website bucket when the prop is absent", () => {
        const { template } = synth();
        const bucket = findSiteBucket(template);

        expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual(
          BLOCK_ACLS_ONLY,
        );
        expect(bucket.Properties.WebsiteConfiguration).toEqual({
          ErrorDocument: "index.html",
          IndexDocument: "index.html",
        });
        expect(bucket.Properties.AccessControl).toBe("BucketOwnerFullControl");
      });

      it("keeps the website origin and no default root object by default", () => {
        const { template } = synth();
        const config = findDistribution(template).Properties.DistributionConfig;

        expect(config.DefaultRootObject).toBeUndefined();
        expect(config.Origins[0].CustomOriginConfig).toBeDefined();
        expect(
          Object.keys(
            template.findResources("AWS::CloudFront::OriginAccessControl"),
          ),
        ).toHaveLength(0);
      });

      it("grants public read by default", () => {
        const { template } = synth();

        expect(() =>
          template.hasResourceProperties("AWS::S3::BucketPolicy", {
            PolicyDocument: Match.objectLike({
              Statement: Match.arrayWith([
                Match.objectLike({
                  Action: "s3:GetObject",
                  Principal: { AWS: "*" },
                }),
              ]),
            }),
          }),
        ).not.toThrow();
      });

      it("behaves the same when the prop is explicitly false", () => {
        const { template } = synth({ originAccessControl: false });

        expect(
          findSiteBucket(template).Properties.WebsiteConfiguration,
        ).toEqual({ ErrorDocument: "index.html", IndexDocument: "index.html" });
      });
    });

    describe("bucketProps composition", () => {
      it("keeps unrelated bucket props", () => {
        const { template } = synth({
          originAccessControl: true,
          versioned: true,
        });
        const bucket = findSiteBucket(template);

        expect(bucket.Properties.VersioningConfiguration).toEqual({
          Status: "Enabled",
        });
        expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual(
          BLOCK_ALL,
        );
      });

      it("throws when bucketProps also asks for publicReadAccess", () => {
        expect(() =>
          synth({ originAccessControl: true, publicReadAccess: true }),
        ).toThrow(ConfigurationError);
      });

      it("throws when bucketProps also asks for a website document", () => {
        expect(() =>
          synth({
            originAccessControl: true,
            websiteIndexDocument: "index.html",
          }),
        ).toThrow(ConfigurationError);
      });

      it("allows a caller-supplied blockPublicAccess override", () => {
        const { template } = synth({
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
          originAccessControl: true,
        });

        expect(
          findSiteBucket(template).Properties.PublicAccessBlockConfiguration,
        ).toEqual(BLOCK_ACLS_ONLY);
      });
    });
  });
});
