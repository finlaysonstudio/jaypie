import { describe, expect, it } from "vitest";

import { isValidAlias, validateAlias } from "../core/validate";

describe("isValidAlias", () => {
  describe("valid aliases", () => {
    it("accepts lowercase alphanumeric", () => {
      expect(isValidAlias("aws")).toBe(true);
      expect(isValidAlias("test123")).toBe(true);
    });

    it("accepts hyphens", () => {
      expect(isValidAlias("my-skill")).toBe(true);
      expect(isValidAlias("aws-lambda")).toBe(true);
    });

    it("accepts underscores", () => {
      expect(isValidAlias("my_skill")).toBe(true);
      expect(isValidAlias("aws_lambda")).toBe(true);
    });

    it("accepts mixed valid characters", () => {
      expect(isValidAlias("my-skill_123")).toBe(true);
    });

    it("normalizes before validation", () => {
      expect(isValidAlias("AWS")).toBe(true);
      expect(isValidAlias("  skill  ")).toBe(true);
    });
  });

  describe("invalid aliases", () => {
    it("rejects forward slashes", () => {
      expect(isValidAlias("path/to/skill")).toBe(false);
    });

    it("rejects backslashes", () => {
      expect(isValidAlias("path\\to\\skill")).toBe(false);
    });

    it("rejects path traversal", () => {
      expect(isValidAlias("../etc")).toBe(false);
      expect(isValidAlias("..")).toBe(false);
    });

    it("rejects spaces", () => {
      expect(isValidAlias("my skill")).toBe(false);
    });

    it("rejects special characters", () => {
      expect(isValidAlias("my@skill")).toBe(false);
      expect(isValidAlias("my.skill")).toBe(false);
      expect(isValidAlias("my!skill")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidAlias("")).toBe(false);
    });
  });
});

describe("validateAlias", () => {
  it("returns normalized alias for valid input", () => {
    expect(validateAlias("aws")).toBe("aws");
    expect(validateAlias("AWS")).toBe("aws");
    expect(validateAlias("  my-skill  ")).toBe("my-skill");
  });

  it("throws BadRequestError for invalid alias", () => {
    expect(() => validateAlias("../etc")).toThrow();
    expect(() => validateAlias("path/to/skill")).toThrow();
  });

  it("includes helpful message in error", () => {
    expect(() => validateAlias("bad/alias")).toThrow(/Invalid skill alias/);
    expect(() => validateAlias("bad/alias")).toThrow(/alphanumeric/);
  });
});
