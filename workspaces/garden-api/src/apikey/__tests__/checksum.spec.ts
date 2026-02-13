import { describe, expect, it } from "vitest";

import { computeChecksum, isValidApiKeyFormat } from "../checksum.js";

//
//
// Tests
//

describe("computeChecksum", () => {
  it("is a function", () => {
    expect(typeof computeChecksum).toBe("function");
  });

  it("returns a 4-character string", () => {
    const result = computeChecksum("a".repeat(32));
    expect(result).toHaveLength(4);
  });

  it("is deterministic", () => {
    const body = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    expect(computeChecksum(body)).toBe(computeChecksum(body));
  });

  it("returns different checksums for different inputs", () => {
    const a = computeChecksum("a".repeat(32));
    const b = computeChecksum("b".repeat(32));
    expect(a).not.toBe(b);
  });

  it("only contains base62 characters", () => {
    const base62 = /^[0-9A-Za-z]+$/;
    const result = computeChecksum("Test1234567890ABCDEFGHIJKLMNOPqr");
    expect(result).toMatch(base62);
  });
});

describe("isValidApiKeyFormat", () => {
  const VALID_BODY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
  const VALID_KEY = `sk_jpi_${VALID_BODY}${computeChecksum(VALID_BODY)}`;

  it("is a function", () => {
    expect(typeof isValidApiKeyFormat).toBe("function");
  });

  it("returns true for a valid key", () => {
    expect(isValidApiKeyFormat(VALID_KEY)).toBe(true);
  });

  it("returns false for wrong prefix", () => {
    const bad = `sk_xyz_${VALID_BODY}${computeChecksum(VALID_BODY)}`;
    expect(isValidApiKeyFormat(bad)).toBe(false);
  });

  it("returns false for wrong length", () => {
    expect(isValidApiKeyFormat("sk_jpi_short")).toBe(false);
  });

  it("returns false for invalid characters in body", () => {
    const badBody = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^";
    const bad = `sk_jpi_${badBody}${computeChecksum(badBody)}`;
    expect(isValidApiKeyFormat(bad)).toBe(false);
  });

  it("returns false for wrong checksum", () => {
    const bad = `sk_jpi_${VALID_BODY}ZZZZ`;
    expect(isValidApiKeyFormat(bad)).toBe(false);
  });

  it("returns false for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidApiKeyFormat(undefined as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidApiKeyFormat(123 as any)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidApiKeyFormat("")).toBe(false);
  });
});
