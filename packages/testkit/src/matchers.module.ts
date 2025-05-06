import * as jestExtendedMatchers from "jest-extended";
import { matchers as jestJsonSchemaMatchers } from "jest-json-schema";
import toBeCalledAboveTrace from "./matchers/toBeCalledAboveTrace.matcher.js";
import toBeCalledWithInitialParams from "./matchers/toBeCalledWithInitialParams.matcher.js";
import toBeClass from "./matchers/toBeClass.matcher.js";
import toBeJaypieError from "./matchers/toBeJaypieError.matcher.js";
import { toBeMockFunction } from "./matchers/toBeMockFunction.matcher.js";
import {
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSignedCookie,
  toMatchUuid,
  toMatchUuid4,
  toMatchUuid5,
} from "./matchers/toMatch.matcher.js";
import toThrowError from "./matchers/toThrowError.matcher.js";
import toThrowJaypieError, {
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,
} from "./matchers/toThrowJaypieError.matcher.js";

// Combine all matchers
const matchers = {
  // Custom Jaypie matchers
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toBeMockFunction,
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSignedCookie,
  toMatchSchema: jestJsonSchemaMatchers.toMatchSchema,
  toMatchUuid,
  toMatchUuid4,
  toMatchUuid5,
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowJaypieError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,

  // Include all jest-extended matchers
  ...jestExtendedMatchers,
};

export default matchers;
