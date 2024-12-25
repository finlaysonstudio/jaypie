import { describe, expect, it } from "vitest";

// Subject
import matchers from "../matchers.module";

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
