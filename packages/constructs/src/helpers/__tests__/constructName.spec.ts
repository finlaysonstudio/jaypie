import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { constructName } from "../constructName";

describe("constructName", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PROJECT_SPONSOR = "findustryai";
    process.env.PROJECT_ENV = "sandbox";
    process.env.PROJECT_KEY = "agents";
    process.env.PROJECT_NONCE = "a9c11a31";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is sponsor-first, honoring PROJECT_SPONSOR", () => {
    expect(constructName("document-lake")).toBe(
      "findustryai-sandbox-agents-document-lake-a9c11a31",
    );
  });

  it("accepts a sponsor override", () => {
    expect(constructName("document-lake", { sponsor: "finlaysonstudio" })).toBe(
      "finlaysonstudio-sandbox-agents-document-lake-a9c11a31",
    );
  });

  it("accepts env/key/nonce overrides", () => {
    expect(
      constructName("document-lake", {
        env: "production",
        key: "core",
        nonce: "z1",
      }),
    ).toBe("findustryai-production-core-document-lake-z1");
  });
});
