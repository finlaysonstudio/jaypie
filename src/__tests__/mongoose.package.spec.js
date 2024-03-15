// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import { connectFromSecretEnv, disconnect } from "../mongoose.package.js";

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

describe("Mongoose Package", () => {
  it("Works", () => {
    expect(connectFromSecretEnv).toBeFunction();
    expect(disconnect).toBeFunction();
  });
});
