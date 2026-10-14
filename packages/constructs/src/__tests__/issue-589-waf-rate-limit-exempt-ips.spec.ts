import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";

import { JaypieDistribution, JaypieWafConfig } from "../JaypieDistribution";
import {
  JaypieWebDeploymentBucket,
  JaypieWebDeploymentBucketWafConfig,
} from "../JaypieWebDeploymentBucket";

//
//
// Constants
//

const IPV4_CIDR = "203.0.113.10/32";
const IPV6_CIDR = "2001:db8::/48";
const RATE_LIMIT_RULE_NAME = "RateLimitPerIp";

//
//
// Helpers
//

interface RateRule {
  Name: string;
  Statement: {
    RateBasedStatement: {
      AggregateKeyType: string;
      Limit: number;
      ScopeDownStatement?: Record<string, unknown>;
    };
  };
}

interface IpSet {
  Addresses: string[];
  IPAddressVersion: string;
  Scope: string;
}

function rateRule(template: Template): RateRule {
  const webAcls = Object.values(
    template.findResources("AWS::WAFv2::WebACL"),
  ) as { Properties: { Rules: RateRule[] } }[];
  expect(webAcls).toHaveLength(1);
  const rule = webAcls[0].Properties.Rules.find(
    (r) => r.Name === RATE_LIMIT_RULE_NAME,
  );
  expect(rule).toBeDefined();
  return rule as RateRule;
}

function ipSets(template: Template): IpSet[] {
  return Object.values(template.findResources("AWS::WAFv2::IPSet")).map(
    (resource) => (resource as { Properties: IpSet }).Properties,
  );
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

describe("Issue #589: WAF rate limit exempt IPs", () => {
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
    it("keeps the existing rule with waf: true", () => {
      const template = synthDistribution(true);
      const rule = rateRule(template);
      expect(rule.Statement.RateBasedStatement).toEqual({
        AggregateKeyType: "IP",
        Limit: 2000,
      });
      expect(ipSets(template)).toHaveLength(0);
    });

    it("keeps rateLimitPerIp working without a scope-down", () => {
      const template = synthDistribution({ name: "api", rateLimitPerIp: 500 });
      const rule = rateRule(template);
      expect(rule.Statement.RateBasedStatement.Limit).toBe(500);
      expect(rule.Statement.RateBasedStatement.ScopeDownStatement).toBe(
        undefined,
      );
    });
  });

  describe("Error Conditions", () => {
    it("throws on an invalid CIDR", () => {
      expect(() =>
        synthDistribution({
          name: "api",
          rateLimit: { exemptIps: ["not-an-ip/32"] },
        }),
      ).toThrow(ConfigurationError);
    });

    it("throws on an address without a prefix length", () => {
      expect(() =>
        synthDistribution({
          name: "api",
          rateLimit: { exemptIps: ["203.0.113.10"] },
        }),
      ).toThrow(ConfigurationError);
    });

    it("throws on an out-of-range prefix length", () => {
      expect(() =>
        synthDistribution({
          name: "api",
          rateLimit: { exemptIps: ["203.0.113.10/33"] },
        }),
      ).toThrow(ConfigurationError);
    });

    it("throws when rateLimit.perIp and rateLimitPerIp are both set", () => {
      expect(() =>
        synthDistribution({
          name: "api",
          rateLimit: { perIp: 3000 },
          rateLimitPerIp: 500,
        }),
      ).toThrow(ConfigurationError);
    });
  });

  describe("Features", () => {
    it("sets the limit from rateLimit.perIp", () => {
      const template = synthDistribution({
        name: "api",
        rateLimit: { perIp: 3000 },
      });
      expect(rateRule(template).Statement.RateBasedStatement.Limit).toBe(3000);
    });

    it("exempts an IPv4 set through a not scope-down", () => {
      const template = synthDistribution({
        name: "api",
        rateLimit: { exemptIps: [IPV4_CIDR] },
      });
      const sets = ipSets(template);
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({
        Addresses: [IPV4_CIDR],
        IPAddressVersion: "IPV4",
        Scope: "CLOUDFRONT",
      });
      const scopeDown = rateRule(template).Statement.RateBasedStatement
        .ScopeDownStatement as {
        NotStatement: { Statement: Record<string, unknown> };
      };
      expect(scopeDown.NotStatement.Statement).toHaveProperty(
        "IPSetReferenceStatement",
      );
    });

    it("splits IPv4 and IPv6 into two sets joined by an or", () => {
      const template = synthDistribution({
        name: "api",
        rateLimit: { exemptIps: [IPV4_CIDR, IPV6_CIDR], perIp: 2000 },
      });
      const sets = ipSets(template);
      expect(sets.map((set) => set.IPAddressVersion).sort()).toEqual([
        "IPV4",
        "IPV6",
      ]);
      expect(sets.find((set) => set.IPAddressVersion === "IPV6")).toMatchObject(
        { Addresses: [IPV6_CIDR] },
      );
      const scopeDown = rateRule(template).Statement.RateBasedStatement
        .ScopeDownStatement as {
        NotStatement: {
          Statement: { OrStatement: { Statements: unknown[] } };
        };
      };
      expect(
        scopeDown.NotStatement.Statement.OrStatement.Statements,
      ).toHaveLength(2);
    });

    it("leaves the rule unchanged for an empty exemptIps list", () => {
      const template = synthDistribution({
        name: "api",
        rateLimit: { exemptIps: [] },
      });
      expect(
        rateRule(template).Statement.RateBasedStatement.ScopeDownStatement,
      ).toBe(undefined);
      expect(ipSets(template)).toHaveLength(0);
    });

    it("applies to JaypieWebDeploymentBucket", () => {
      const template = synthWebDeploymentBucket({
        rateLimit: { exemptIps: [IPV6_CIDR] },
      });
      expect(ipSets(template)).toHaveLength(1);
      expect(
        rateRule(template).Statement.RateBasedStatement.ScopeDownStatement,
      ).toHaveProperty("NotStatement");
    });
  });
});
