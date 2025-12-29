import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { envHostname } from "../envHostname";

describe("envHostname", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CDK_ENV_DOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
    delete process.env.CDK_ENV_SUBDOMAIN;
    delete process.env.PROJECT_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Base Cases", () => {
    it("returns domain when only domain is provided", () => {
      const result = envHostname({ domain: "example.com" });
      expect(result).toBe("example.com");
    });

    it("uses CDK_ENV_DOMAIN from environment when domain not provided", () => {
      process.env.CDK_ENV_DOMAIN = "env-domain.com";
      const result = envHostname({});
      expect(result).toBe("env-domain.com");
    });

    it("uses CDK_ENV_HOSTED_ZONE when neither domain nor CDK_ENV_DOMAIN provided", () => {
      delete process.env.CDK_ENV_DOMAIN;
      process.env.CDK_ENV_HOSTED_ZONE = "hosted-zone.com";
      const result = envHostname({});
      expect(result).toBe("hosted-zone.com");
    });
  });

  describe("Error Conditions", () => {
    it("throws ConfigurationError when no domain is available", () => {
      delete process.env.CDK_ENV_DOMAIN;
      delete process.env.CDK_ENV_HOSTED_ZONE;
      expect(() => envHostname({})).toThrow(
        "No hostname `domain` provided. Set CDK_ENV_DOMAIN or CDK_ENV_HOSTED_ZONE to use environment domain",
      );
    });
  });

  describe("Security", () => {
    it("treats @ as undefined for component", () => {
      const result = envHostname({
        component: "@",
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });

    it("treats empty string as undefined for component", () => {
      const result = envHostname({
        component: "",
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });

    it("treats @ as undefined for subdomain", () => {
      const result = envHostname({
        subdomain: "@",
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });

    it("treats empty string as undefined for subdomain", () => {
      const result = envHostname({
        subdomain: "",
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });

    it("falls back to CDK_ENV_SUBDOMAIN when subdomain is @", () => {
      process.env.CDK_ENV_SUBDOMAIN = "fallback";
      const result = envHostname({
        subdomain: "@",
        domain: "example.com",
      });
      expect(result).toBe("fallback.example.com");
    });
  });

  describe("Observability", () => {
    it("maintains consistent output format", () => {
      const result = envHostname({
        component: "api",
        domain: "example.com",
        env: "sandbox",
        subdomain: "us-east-1",
      });
      expect(result).toMatch(/^[a-z0-9.-]+$/);
    });
  });

  describe("Happy Paths", () => {
    it("constructs full hostname with all parameters", () => {
      const result = envHostname({
        component: "api",
        domain: "example.com",
        env: "sandbox",
        subdomain: "us-east-1",
      });
      expect(result).toBe("api.us-east-1.sandbox.example.com");
    });

    it("uses PROJECT_ENV from environment when env not provided", () => {
      process.env.PROJECT_ENV = "production";
      const result = envHostname({
        component: "web",
        domain: "example.com",
      });
      expect(result).toBe("web.example.com");
    });

    it("uses CDK_ENV_SUBDOMAIN from environment when subdomain not provided", () => {
      process.env.CDK_ENV_SUBDOMAIN = "eu-west-1";
      const result = envHostname({
        component: "api",
        domain: "example.com",
        env: "staging",
      });
      expect(result).toBe("api.eu-west-1.staging.example.com");
    });
  });

  describe("Features", () => {
    it("skips dots for missing parts", () => {
      const result = envHostname({
        component: "api",
        domain: "example.com",
      });
      expect(result).toBe("api.example.com");
      expect(result).not.toContain("..");
    });

    it("handles only domain and env", () => {
      const result = envHostname({
        domain: "example.com",
        env: "sandbox",
      });
      expect(result).toBe("sandbox.example.com");
    });

    it("handles only domain and subdomain", () => {
      const result = envHostname({
        domain: "example.com",
        subdomain: "us-west-2",
      });
      expect(result).toBe("us-west-2.example.com");
    });

    it("handles only domain and component", () => {
      const result = envHostname({
        component: "api",
        domain: "example.com",
      });
      expect(result).toBe("api.example.com");
    });
  });

  describe("Specific Scenarios", () => {
    it("prioritizes provided values over environment variables", () => {
      process.env.CDK_ENV_DOMAIN = "env-domain.com";
      process.env.CDK_ENV_SUBDOMAIN = "env-subdomain";
      process.env.PROJECT_ENV = "env-env";

      const result = envHostname({
        component: "api",
        domain: "override.com",
        env: "override-env",
        subdomain: "override-subdomain",
      });

      expect(result).toBe("api.override-subdomain.override-env.override.com");
    });

    it("combines environment and provided values correctly", () => {
      process.env.PROJECT_ENV = "production";
      process.env.CDK_ENV_SUBDOMAIN = "us-east-1";

      const result = envHostname({
        component: "api",
        domain: "example.com",
      });

      expect(result).toBe("api.us-east-1.example.com");
    });

    it("handles all undefined optional parameters", () => {
      const result = envHostname({
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });

    it("Returns the apex domain in production", () => {
      process.env.PROJECT_ENV = "production";
      const result = envHostname({
        domain: "example.com",
      });
      expect(result).toBe("example.com");
    });
  });

  describe("Deduplication", () => {
    it("does not duplicate env when domain already contains it", () => {
      const result = envHostname({
        domain: "sandbox.findustryai.com",
        env: "sandbox",
        subdomain: "evaluations",
      });
      expect(result).toBe("evaluations.sandbox.findustryai.com");
    });

    it("does not duplicate subdomain when domain already contains it", () => {
      const result = envHostname({
        domain: "evaluations.sandbox.findustryai.com",
        env: "sandbox",
        subdomain: "evaluations",
      });
      expect(result).toBe("evaluations.sandbox.findustryai.com");
    });

    it("does not duplicate component when domain already contains it", () => {
      const result = envHostname({
        component: "api",
        domain: "api.sandbox.findustryai.com",
        env: "sandbox",
      });
      expect(result).toBe("api.sandbox.findustryai.com");
    });

    it("does not duplicate any part when domain contains all parts", () => {
      const result = envHostname({
        component: "api",
        domain: "api.evaluations.sandbox.findustryai.com",
        env: "sandbox",
        subdomain: "evaluations",
      });
      expect(result).toBe("api.evaluations.sandbox.findustryai.com");
    });

    it("adds parts not already in domain", () => {
      const result = envHostname({
        component: "api",
        domain: "sandbox.findustryai.com",
        env: "sandbox",
        subdomain: "evaluations",
      });
      expect(result).toBe("api.evaluations.sandbox.findustryai.com");
    });

    it("handles environment variables with deduplication", () => {
      process.env.CDK_ENV_HOSTED_ZONE = "sandbox.findustryai.com";
      process.env.PROJECT_ENV = "sandbox";
      process.env.CDK_ENV_SUBDOMAIN = "evaluations";

      const result = envHostname({});
      expect(result).toBe("evaluations.sandbox.findustryai.com");
    });
  });
});
