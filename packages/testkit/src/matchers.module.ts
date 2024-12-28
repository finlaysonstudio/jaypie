import toBeCalledAboveTrace from "./matchers/toBeCalledAboveTrace.matcher.js";
import toBeCalledWithInitialParams from "./matchers/toBeCalledWithInitialParams.matcher.js";
import toBeClass from "./matchers/toBeClass.matcher.js";
import toBeJaypieError from "./matchers/toBeJaypieError.matcher.js";
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

const matchers = {
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSignedCookie,
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
};

export default matchers;
