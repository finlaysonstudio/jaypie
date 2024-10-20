// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import log from "../log.lib.js";

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

describe("Log Lib", () => {
  it("Exports what we expect", () => {
    expect(log).toBeObject();
  });
});
