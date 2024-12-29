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

  it("Contains all expected matchers", () => {
    expect(matchers).toContainKeys([
      "toBeCalledAboveTrace",
      "toBeCalledWithInitialParams",
      "toBeClass",
      "toBeJaypieError",
      "toMatchBase64",
      "toMatchJwt",
      "toMatchMongoId",
      "toMatchSchema",
      "toMatchSignedCookie",
      "toMatchUuid",
      "toMatchUuid4",
      "toMatchUuid5",
      "toThrowBadGatewayError",
      "toThrowBadRequestError",
      "toThrowConfigurationError",
      "toThrowForbiddenError",
      "toThrowGatewayTimeoutError",
      "toThrowInternalError",
      "toThrowJaypieError",
      "toThrowNotFoundError",
      "toThrowUnauthorizedError",
      "toThrowUnavailableError",
    ]);
  });
});
