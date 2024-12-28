import { describe, expect, it } from "vitest";

// Subject
import {
  LOG,
  RE_BASE64_PATTERN,
  RE_JWT_PATTERN,
  RE_MONGO_ID_PATTERN,
  RE_SIGNED_COOKIE_PATTERN,
  RE_UUID_4_PATTERN,
  RE_UUID_5_PATTERN,
  RE_UUID_PATTERN,
} from "../constants";

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(LOG).toBeObject();
  });
  it("Exports regular expressions we expect", () => {
    expect(RE_BASE64_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_JWT_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_MONGO_ID_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_SIGNED_COOKIE_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_UUID_4_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_UUID_5_PATTERN).toBeInstanceOf(RegExp);
    expect(RE_UUID_PATTERN).toBeInstanceOf(RegExp);
  });
});
