import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack, Tags } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { CDK } from "../constants";
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

describe("resolveCertificate", () => {
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
      expect(resolveCertificate).toBeFunction();
    });

    it("returns undefined when certificate is false", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const result = resolveCertificate(stack, {
        certificate: false,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(result).toBeUndefined();
    });
  });

  describe("Certificate Creation", () => {
    it("creates certificate at stack level when certificate is true", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Create a child construct to verify certificate is created at stack level
      class ChildConstruct extends Construct {
        public certificate?: acm.ICertificate;
        constructor(scope: Construct, id: string) {
          super(scope, id);
          this.certificate = resolveCertificate(this, {
            certificate: true,
            domainName: "api.example.com",
            zone: hostedZone,
          });
        }
      }

      const child = new ChildConstruct(stack, "Child");
      const template = Template.fromStack(stack);

      expect(child.certificate).toBeDefined();

      // Certificate should exist
      const certificates = findCertificates(template);
      expect(certificates.length).toBe(1);
      expect(certificates[0].Properties.DomainName).toBe("api.example.com");
    });

    it("creates certificate with default when certificate is undefined", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const result = resolveCertificate(stack, {
        domainName: "api.example.com",
        zone: hostedZone,
      });
      const template = Template.fromStack(stack);

      expect(result).toBeDefined();

      const certificates = findCertificates(template);
      expect(certificates.length).toBe(1);
    });

    it("adds role tag to created certificate", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      resolveCertificate(stack, {
        certificate: true,
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

      resolveCertificate(stack, {
        certificate: true,
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
  });

  describe("Certificate Caching", () => {
    it("returns same certificate for same domain in same stack", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache before test
      clearCertificateCache(stack);

      const cert1 = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      const cert2 = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(cert1).toBe(cert2);

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      // Should only create one certificate
      expect(certificates.length).toBe(1);
    });

    it("creates separate certificates for different domains", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache before test
      clearCertificateCache(stack);

      const cert1 = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      const cert2 = resolveCertificate(stack, {
        certificate: true,
        domainName: "web.example.com",
        zone: hostedZone,
      });

      expect(cert1).not.toBe(cert2);

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      // Should create two certificates
      expect(certificates.length).toBe(2);
    });

    it("caches certificate per stack (different stacks get different certs)", () => {
      const stack1 = new Stack();
      const stack2 = new Stack();
      const hostedZone1 = new route53.HostedZone(stack1, "TestZone", {
        zoneName: "example.com",
      });
      const hostedZone2 = new route53.HostedZone(stack2, "TestZone", {
        zoneName: "example.com",
      });

      // Clear caches
      clearCertificateCache(stack1);
      clearCertificateCache(stack2);

      const cert1 = resolveCertificate(stack1, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone1,
      });

      const cert2 = resolveCertificate(stack2, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone2,
      });

      // Different stacks should have different certificate instances
      expect(cert1).not.toBe(cert2);
    });
  });

  describe("Passing Existing Certificate", () => {
    it("returns provided certificate as-is", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const existingCert = new acm.Certificate(stack, "ExistingCert", {
        domainName: "api.example.com",
      });

      const result = resolveCertificate(stack, {
        certificate: existingCert,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(result).toBe(existingCert);
    });

    it("does not cache provided certificates", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache
      clearCertificateCache(stack);

      const existingCert = new acm.Certificate(stack, "ExistingCert", {
        domainName: "api.example.com",
      });

      resolveCertificate(stack, {
        certificate: existingCert,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // Requesting again with true should create a new certificate
      const newCert = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      // This should be a new certificate (not the existing one)
      expect(newCert).not.toBe(existingCert);
    });
  });

  describe("Importing from ARN", () => {
    it("imports certificate from ARN string", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      const arnString =
        "arn:aws:acm:us-east-1:123456789012:certificate/abc-123-def";

      const result = resolveCertificate(stack, {
        certificate: arnString,
        domainName: "api.example.com",
        zone: hostedZone,
      });

      expect(result).toBeDefined();
      expect(result?.certificateArn).toBe(arnString);
    });
  });

  describe("Domain Sanitization", () => {
    it("sanitizes domain name for construct ID", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // This should not throw - dots in domain should be converted to hyphens
      const result = resolveCertificate(stack, {
        certificate: true,
        domainName: "api.sub.example.com",
        zone: hostedZone,
      });

      expect(result).toBeDefined();

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      expect(certificates.length).toBe(1);
      expect(certificates[0].Properties.DomainName).toBe("api.sub.example.com");
    });
  });

  describe("Integration with Constructs", () => {
    it("allows multiple constructs to share the same certificate", () => {
      const stack = new Stack();
      const hostedZone = new route53.HostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });

      // Clear cache
      clearCertificateCache(stack);

      // Simulate two different constructs requesting the same certificate
      class ConstructA extends Construct {
        public certificate?: acm.ICertificate;
        constructor(scope: Construct, id: string) {
          super(scope, id);
          this.certificate = resolveCertificate(this, {
            certificate: true,
            domainName: "api.example.com",
            zone: hostedZone,
          });
        }
      }

      class ConstructB extends Construct {
        public certificate?: acm.ICertificate;
        constructor(scope: Construct, id: string) {
          super(scope, id);
          this.certificate = resolveCertificate(this, {
            certificate: true,
            domainName: "api.example.com",
            zone: hostedZone,
          });
        }
      }

      const constructA = new ConstructA(stack, "ConstructA");
      const constructB = new ConstructB(stack, "ConstructB");

      // Both should get the same certificate
      expect(constructA.certificate).toBe(constructB.certificate);

      const template = Template.fromStack(stack);
      const certificates = findCertificates(template);
      // Only one certificate should be created
      expect(certificates.length).toBe(1);
    });
  });
});
