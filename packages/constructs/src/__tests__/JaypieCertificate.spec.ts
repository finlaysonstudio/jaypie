import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { CDK } from "../constants";
import { JaypieCertificate } from "../JaypieCertificate";
import {
  clearCertificateCache,
  resolveCertificate,
} from "../helpers/resolveCertificate";

// Helper function to find certificates in the template
function findCertificates(template: Template) {
  const resources = template.findResources(
    "AWS::CertificateManager::Certificate",
  );
  return Object.values(resources);
}

describe("JaypieCertificate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_PERSONAL;
    delete process.env.CDK_ENV_EPHEMERAL;
    delete process.env.PROJECT_ENV;
    delete process.env.PROJECT_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieCertificate).toBeFunction();
    });

    it("creates a certificate with explicit props", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      expect(cert).toBeDefined();
      expect(cert.certificate).toBeDefined();
      expect(cert.domainName).toBe("api.example.com");

      const certificates = findCertificates(template);
      expect(certificates.length).toBe(1);
      expect(certificates[0].Properties.DomainName).toBe("api.example.com");
    });
  });

  describe("Flexible Constructor Signatures", () => {
    it("creates certificate with (scope) signature using env vars", () => {
      process.env.CDK_ENV_API_HOST_NAME = "api.example.com";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      // Create with just scope - must provide zone via env or prop
      // For this test, we'll use the props variant with no explicit id
      const cert = new JaypieCertificate(stack, {
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      expect(cert).toBeDefined();
      expect(cert.domainName).toBe("api.example.com");
      // Auto-generated ID uses JaypieCert prefix
      expect(cert.node.id).toBe("JaypieCert-api-example-com");

      const certificates = findCertificates(template);
      expect(certificates.length).toBe(1);
    });

    it("creates certificate with (scope, props) signature and auto-generates ID", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache to ensure clean test
      clearCertificateCache(stack);

      const cert = new JaypieCertificate(stack, {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert).toBeDefined();
      expect(cert.domainName).toBe("api.example.com");
      // ID should be auto-generated as "JaypieCert-api-example-com"
      expect(cert.node.id).toBe("JaypieCert-api-example-com");
    });

    it("creates certificate with (scope, id, props) signature", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "CustomId", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert).toBeDefined();
      expect(cert.node.id).toBe("CustomId");
    });

    it("allows id override via props.id in (scope, props) signature", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, {
        domainName: "api.example.com",
        id: "OverriddenId",
        zone: hostedZone,
      });

      expect(cert).toBeDefined();
      expect(cert.node.id).toBe("OverriddenId");
    });

    it("auto-generated ID allows certificate sharing via resolveCertificate", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache to ensure clean test
      clearCertificateCache(stack);

      // Create certificate with auto-generated ID
      const cert = new JaypieCertificate(stack, {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // Call resolveCertificate with same domain - should return the same certificate
      // because JaypieCertificate uses resolveCertificate internally
      const sharedCert = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // Should be the same certificate instance (both use the same cache)
      expect(sharedCert).toBe(cert.certificate);

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      // Only one certificate should exist
      expect(certificates.length).toBe(1);
    });
  });

  describe("Error Conditions", () => {
    it("throws when domainName is not provided and no environment variables set", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      expect(() => {
        new JaypieCertificate(stack, "TestCert", {
          zone: hostedZone,
        });
      }).toThrow(
        "domainName is required for JaypieCertificate (or set CDK_ENV_API_HOST_NAME / CDK_ENV_API_SUBDOMAIN)",
      );
    });

    it("throws when zone is not provided and no environment variables set (non-consumer)", () => {
      const stack = new Stack();

      expect(() => {
        new JaypieCertificate(stack, "TestCert", {
          domainName: "api.example.com",
        });
      }).toThrow(
        "zone is required for JaypieCertificate when not consuming (or set CDK_ENV_API_HOSTED_ZONE / CDK_ENV_HOSTED_ZONE)",
      );
    });

    it("throws when CDK_ENV_API_SUBDOMAIN is invalid", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "invalid subdomain with spaces";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();

      expect(() => {
        new JaypieCertificate(stack, "TestCert");
      }).toThrow("CDK_ENV_API_SUBDOMAIN is not a valid subdomain");
    });

    it("throws when domainName is invalid", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      expect(() => {
        new JaypieCertificate(stack, "TestCert", {
          domainName: "invalid hostname with spaces",
          zone: hostedZone,
        });
      }).toThrow("domainName is not a valid hostname");
    });
  });

  describe("Environment Variable Configuration", () => {
    it("uses CDK_ENV_API_HOST_NAME from environment", () => {
      process.env.CDK_ENV_API_HOST_NAME = "api-env.example.com";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        zone: hostedZone,
      });

      expect(cert.domainName).toBe("api-env.example.com");
    });

    it("constructs domainName from CDK_ENV_API_SUBDOMAIN and CDK_ENV_API_HOSTED_ZONE", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "api";
      process.env.CDK_ENV_API_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        zone: hostedZone,
      });

      expect(cert.domainName).toBe("api.example.com");
    });

    it("uses CDK_ENV_HOSTED_ZONE as fallback for zone", () => {
      process.env.CDK_ENV_API_SUBDOMAIN = "api";
      process.env.CDK_ENV_HOSTED_ZONE = "example.com";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        zone: hostedZone,
      });

      expect(cert.domainName).toBe("api.example.com");
    });
  });

  describe("Features", () => {
    it("adds role tag to certificate", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
        roleTag: CDK.ROLE.HOSTING,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CertificateManager::Certificate", {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.HOSTING,
          }),
        ]),
      });
    });

    it("uses default API role tag", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CertificateManager::Certificate", {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.API,
          }),
        ]),
      });
    });

    it("creates CfnOutput with certificate ARN", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      const outputs = template.findOutputs("*");
      expect(Object.keys(outputs).length).toBeGreaterThan(0);
    });
  });

  describe("Provider/Consumer Pattern", () => {
    it("creates export when provider is true", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
        provider: true,
      });
      const template = Template.fromStack(stack);

      const outputs = template.findOutputs("*");
      expect(Object.keys(outputs).length).toBeGreaterThan(0);

      // Find the output with an export name
      const exportedOutput = Object.values(outputs).find((o) => o.Export);
      expect(exportedOutput).toBeDefined();
      expect(exportedOutput?.Export?.Name).toBeDefined();
    });

    it("auto-detects provider from PROJECT_ENV=sandbox", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      const outputs = template.findOutputs("*");
      const exportedOutput = Object.values(outputs).find((o) => o.Export);
      expect(exportedOutput).toBeDefined();
    });

    it("imports certificate when consumer is true", () => {
      const stack = new Stack();

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        consumer: true,
        export: "test-cert-export",
      });

      expect(cert).toBeDefined();
      expect(cert.certificate).toBeDefined();
    });

    it("auto-detects consumer from PROJECT_ENV=personal", () => {
      process.env.PROJECT_ENV = "personal";
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();

      // Consumer doesn't need zone
      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
      });

      expect(cert).toBeDefined();
    });

    it("auto-detects consumer from CDK_ENV_PERSONAL", () => {
      process.env.CDK_ENV_PERSONAL = "true";
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
      });

      expect(cert).toBeDefined();
    });
  });

  describe("Certificate Sharing", () => {
    it("shares certificate with JaypieDistribution using same domain", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache to ensure clean test
      clearCertificateCache(stack);

      // Create JaypieCertificate first
      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // Call resolveCertificate directly (simulating what JaypieDistribution does)
      const sharedCert = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // Should be the same certificate
      expect(sharedCert).toBe(cert.certificate);

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      // Only one certificate should be created
      expect(certificates.length).toBe(1);
    });

    it("allows passing JaypieCertificate to constructs expecting ICertificate", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // JaypieCertificate implements ICertificate
      const iCert: acm.ICertificate = cert;
      expect(iCert.certificateArn).toBeDefined();
    });
  });

  describe("ICertificate Implementation", () => {
    it("implements certificateArn", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert.certificateArn).toBeDefined();
    });

    it("implements stack property", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert.stack).toBe(stack);
    });

    it("implements env property", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const cert = new JaypieCertificate(stack, "TestCert", {
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
    });
  });
});
