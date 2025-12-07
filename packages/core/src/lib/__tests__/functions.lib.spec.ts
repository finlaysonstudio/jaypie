import { describe, expect, it } from "vitest";

// Subject
import {
  envBoolean,
  envsKey,
  formatError,
  getHeaderFrom,
  getObjectKeyCaseInsensitive,
  placeholders,
  sleep,
} from "../functions.lib.js";

//
//
// Run tests
//

describe("Functions Lib", () => {
  it("Exports functions we expect", () => {
    expect(envBoolean).toBeFunction();
    expect(envsKey).toBeFunction();
    expect(formatError).toBeFunction();
    expect(getHeaderFrom).toBeFunction();
    expect(getObjectKeyCaseInsensitive).toBeFunction();
    expect(placeholders).toBeFunction();
    expect(sleep).toBeFunction();
  });
});
