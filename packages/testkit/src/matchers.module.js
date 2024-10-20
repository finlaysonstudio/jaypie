import { matchers as jsonSchemaMatchers } from "jest-json-schema";

import toBeCalledAboveTrace from "./matchers/toBeCalledAboveTrace.matcher.js";
import toBeCalledWithInitialParams from "./matchers/toBeCalledWithInitialParams.matcher.js";
import toBeClass from "./matchers/toBeClass.matcher.js";
import toBeJaypieError from "./matchers/toBeJaypieError.matcher.js";
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

import {
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSignedCookie,
  toMatchUuid4,
  toMatchUuid5,
  toMatchUuid,
} from "./matchers/toMatch.matcher.js";

//
//
// Export
//

export default {
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toBeValidSchema: jsonSchemaMatchers.toBeValidSchema,
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSchema: jsonSchemaMatchers.toMatchSchema,
  toMatchSignedCookie,
  toMatchUuid4,
  toMatchUuid5,
  toMatchUuid,
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowJaypieError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,
};
