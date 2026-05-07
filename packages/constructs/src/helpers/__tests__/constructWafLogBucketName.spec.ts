import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { constructWafLogBucketName } from "../constructWafLogBucketName";

describe("constructWafLogBucketName", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PROJECT_ENV;
    delete process.env.PROJECT_KEY;
    delete process.env.PROJECT_NONCE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof constructWafLogBucketName).toBe("function");
    });

    it("builds aws-waf-logs prefixed name with env-key-name-waf-nonce shape", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "abcd1234";

      expect(constructWafLogBucketName("api")).toBe(
        "aws-waf-logs-sandbox-jaypie-api-waf-abcd1234",
      );
    });

    it("omits the name segment when called without a name", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "abcd1234";

      expect(constructWafLogBucketName()).toBe(
        "aws-waf-logs-sandbox-jaypie-waf-abcd1234",
      );
    });

    it("lowercases mixed-case construct names", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "abcd1234";

      expect(constructWafLogBucketName("MyWeb")).toBe(
        "aws-waf-logs-sandbox-jaypie-myweb-waf-abcd1234",
      );
    });
  });

  describe("Truncation", () => {
    it("truncates the middle to keep the result within 63 chars", () => {
      process.env.PROJECT_ENV = "development";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "598eea56";

      const name = constructWafLogBucketName("DocumentationBucket");

      expect(name.length).toBeLessThanOrEqual(63);
      expect(name.startsWith("aws-waf-logs-")).toBe(true);
      expect(name.endsWith("-598eea56")).toBe(true);
    });

    it("preserves the nonce suffix verbatim when truncating", () => {
      process.env.PROJECT_ENV = "development";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "598eea56";

      const name = constructWafLogBucketName("DocumentationBucket");

      expect(name.endsWith("-598eea56")).toBe(true);
    });

    it("does not leave a trailing dash after truncation", () => {
      process.env.PROJECT_ENV = "development";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "598eea56";

      const name = constructWafLogBucketName("DocumentationBucket");

      expect(name).not.toMatch(/-+-[^-]+$/);
      const middle = name.slice(
        "aws-waf-logs-".length,
        name.length - "-598eea56".length,
      );
      expect(middle).not.toMatch(/-$/);
    });

    it("does not truncate when the constructed name fits", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "jaypie";
      process.env.PROJECT_NONCE = "abcd";

      const name = constructWafLogBucketName("api");

      expect(name).toBe("aws-waf-logs-sandbox-jaypie-api-waf-abcd");
    });
  });

  describe("Defaults", () => {
    it("falls back to nonce 'cfe2' when PROJECT_NONCE is unset", () => {
      process.env.PROJECT_ENV = "sandbox";
      process.env.PROJECT_KEY = "jaypie";

      expect(constructWafLogBucketName("api")).toBe(
        "aws-waf-logs-sandbox-jaypie-api-waf-cfe2",
      );
    });
  });
});
