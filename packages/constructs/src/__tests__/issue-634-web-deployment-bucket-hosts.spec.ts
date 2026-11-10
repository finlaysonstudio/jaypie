import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { JaypieWebDeploymentBucket } from "../JaypieWebDeploymentBucket";

// #634: JaypieWebDeploymentBucket accepts several hosts, including hosts that
// live in hosted zones other than the primary zone.

function makeStack() {
  const stack = new Stack(undefined, "Stack", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const zone = new route53.HostedZone(stack, "Zone", {
    zoneName: "example.com",
  });
  const tenantZone = new route53.HostedZone(stack, "TenantZone", {
    zoneName: "tenant-domain.com",
  });
  return { stack, tenantZone, zone };
}

function aliases(template: Template): string[] {
  const [distribution] = Object.values(
    template.findResources("AWS::CloudFront::Distribution"),
  );
  return distribution.Properties.DistributionConfig.Aliases;
}

function records(template: Template) {
  return Object.entries(template.findResources("AWS::Route53::RecordSet"))
    .filter(([, record]) => record.Properties.Type === "A")
    .map(([logicalId, record]) => ({
      logicalId,
      name: record.Properties.Name,
      zone: record.Properties.HostedZoneId,
    }));
}

describe("#634 JaypieWebDeploymentBucket multiple hosts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_REPO;
    delete process.env.CDK_ENV_WEB_HOST;
    delete process.env.CDK_ENV_WEB_HOSTED_ZONE;
    delete process.env.CDK_ENV_WEB_SUBDOMAIN;
    process.env.PROJECT_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("aliases, certifies, and records every host in one zone", () => {
    const { stack, zone } = makeStack();

    const construct = new JaypieWebDeploymentBucket(stack, "Web", {
      host: ["app.example.com", "www.example.com"],
      zone,
    });
    const template = Template.fromStack(stack);

    expect(construct.host).toBe("app.example.com");
    expect(construct.hosts).toEqual(["app.example.com", "www.example.com"]);
    expect(aliases(template)).toEqual(["app.example.com", "www.example.com"]);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "app.example.com",
      SubjectAlternativeNames: ["www.example.com"],
    });
    expect(records(template).map((record) => record.name)).toEqual([
      "app.example.com.",
      "www.example.com.",
    ]);
  });

  it("keeps the primary record's construct id", () => {
    const { stack, zone } = makeStack();

    new JaypieWebDeploymentBucket(stack, "Web", {
      host: ["app.example.com", "www.example.com"],
      zone,
    });
    const primary = records(Template.fromStack(stack)).find(
      (record) => record.name === "app.example.com.",
    );

    expect(primary?.logicalId).toMatch(/^WebAliasRecord[0-9A-F]{8}$/);
  });

  it("validates and records hosts in their own zones", () => {
    const { stack, tenantZone, zone } = makeStack();

    new JaypieWebDeploymentBucket(stack, "Web", {
      host: [
        { component: "app", domain: "example.com" },
        { host: "www.tenant-domain.com", zone: tenantZone },
      ],
      zone,
    });
    const template = Template.fromStack(stack);
    const zoneId = stack.resolve(zone.hostedZoneId);
    const tenantZoneId = stack.resolve(tenantZone.hostedZoneId);

    expect(aliases(template)).toEqual([
      "app.example.com",
      "www.tenant-domain.com",
    ]);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "app.example.com",
      DomainValidationOptions: [
        { DomainName: "app.example.com", HostedZoneId: zoneId },
        { DomainName: "www.tenant-domain.com", HostedZoneId: tenantZoneId },
      ],
      SubjectAlternativeNames: ["www.tenant-domain.com"],
    });
    expect(records(template)).toEqual([
      expect.objectContaining({ name: "app.example.com.", zone: zoneId }),
      expect.objectContaining({
        name: "www.tenant-domain.com.",
        zone: tenantZoneId,
      }),
    ]);
  });

  it("aliases and records every host with a caller certificate", () => {
    const { stack, tenantZone, zone } = makeStack();
    const certificate = acm.Certificate.fromCertificateArn(
      stack,
      "Cert",
      "arn:aws:acm:us-east-1:111111111111:certificate/abc",
    );

    new JaypieWebDeploymentBucket(stack, "Web", {
      certificate,
      host: [
        "app.example.com",
        { host: "www.tenant-domain.com", zone: tenantZone },
      ],
      zone,
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::CertificateManager::Certificate", 0);
    expect(aliases(template)).toEqual([
      "app.example.com",
      "www.tenant-domain.com",
    ]);
    expect(records(template)).toHaveLength(2);
  });

  it("throws when a created certificate cannot validate a host", () => {
    const { stack, tenantZone } = makeStack();

    expect(
      () =>
        new JaypieWebDeploymentBucket(stack, "Web", {
          host: [
            { host: "www.tenant-domain.com", zone: tenantZone },
            "app.example.com",
          ],
        }),
    ).toThrow(ConfigurationError);
  });

  it("collapses duplicate hosts", () => {
    const { stack, zone } = makeStack();

    const construct = new JaypieWebDeploymentBucket(stack, "Web", {
      host: ["app.example.com", "app.example.com"],
      zone,
    });

    expect(construct.hosts).toEqual(["app.example.com"]);
  });

  it("throws on an invalid secondary host", () => {
    const { stack, zone } = makeStack();

    expect(
      () =>
        new JaypieWebDeploymentBucket(stack, "Web", {
          host: ["app.example.com", "not a host"],
          zone,
        }),
    ).toThrow(ConfigurationError);
  });

  it("serves a single host unchanged", () => {
    const { stack, zone } = makeStack();

    const construct = new JaypieWebDeploymentBucket(stack, "Web", {
      host: "app.example.com",
      zone,
    });
    const template = Template.fromStack(stack);

    expect(construct.hosts).toEqual(["app.example.com"]);
    expect(aliases(template)).toEqual(["app.example.com"]);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "app.example.com",
    });
  });
});
