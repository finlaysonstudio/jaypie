// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import { PROJECT } from "../index.js";

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

describe("Index", () => {
  it("Works", () => {
    expect(PROJECT).not.toBeUndefined();
    expect(PROJECT.SPONSOR).not.toBeUndefined();
    expect(PROJECT.SPONSOR.JAYPIE).toBeString();
  });
});
