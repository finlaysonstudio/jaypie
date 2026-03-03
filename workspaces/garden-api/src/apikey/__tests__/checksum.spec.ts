import { describe, expect, it } from "vitest";

import { computeChecksum } from "../checksum.js";

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
