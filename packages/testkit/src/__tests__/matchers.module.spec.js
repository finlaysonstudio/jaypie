// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import matchers from "../matchers.module.js";

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

describe("Matchers Module", () => {
  it("Is an object", () => {
    expect(matchers).toBeObject();
  });
  it("Contains matchers we expect", () => {
    expect(matchers).toContainKeys([
      "toBeCalledWithInitialParams",
      "toBeClass",
      "toBeJaypieError",
      "toBeValidSchema",
      "toMatchSchema",
      "toThrowBadRequestError",
      "toThrowConfigurationError",
      "toThrowForbiddenError",
      "toThrowInternalError",
      "toThrowJaypieError",
      "toThrowNotFoundError",
      "toThrowUnauthorizedError",
    ]);
  });
});
