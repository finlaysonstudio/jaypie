import { matchers as jestJsonSchemaMatchers } from "jest-json-schema";
import {
  toBeArray,
  toBeArrayOfSize,
  toBeBoolean,
  toBeEmpty,
  toBeFalse,
  toBeFunction,
  toBeNumber,
  toBeObject,
  toBeString,
  toBeTrue,
  toContainAllKeys,
  toContainKeys,
  toEndWith,
  toInclude,
  toStartWith,
} from "./matchers/extended.matcher.js";
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
const matchers: Record<string, (...args: any[]) => any> = {
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

  // Absorbed jest-extended matchers (formerly via the jest-extended package)
  toBeArray,
  toBeArrayOfSize,
  toBeBoolean,
  toBeEmpty,
  toBeFalse,
  toBeFunction,
  toBeNumber,
  toBeObject,
  toBeString,
  toBeTrue,
  toContainAllKeys,
  toContainKeys,
  toEndWith,
  toInclude,
  toStartWith,
};

export default matchers;
