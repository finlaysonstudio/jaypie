import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Subject
import { JAYPIE, PROJECT } from "../constants.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants", () => {
    expect(JAYPIE).toBeObject();
    expect(PROJECT.SPONSOR.FINLAYSON).toBe("finlaysonstudio");
  });
});
