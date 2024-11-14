import { describe, expect, it } from "vitest";

// Subject
import index from "../index.js";
import {
  BadGatewayError,
  BadRequestError,
  cloneDeep,
  ConfigurationError,
  envBoolean,
  ERROR,
  errorFromStatusCode,
  ForbiddenError,
  force,
  GatewayTimeoutError,
  getHeaderFrom,
  getObjectKeyCaseInsensitive,
  GoneError,
  HTTP,
  IllogicalError,
  InternalError,
  jaypieHandler,
  log,
  MethodNotAllowedError,
  MultiError,
  NAME,
  NotFoundError,
  NotImplementedError,
  optional,
  placeholders,
  ProjectError,
  ProjectMultiError,
  RejectedError,
  required,
  safeParseFloat,
  sleep,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
  uuid,
  validate,
  VALIDATE,
} from "../index.js";

//
//
// Run tests
//

describe("Jaypie Core", () => {
  it("Exports no default", () => {
    expect(index).toBeUndefined();
  });
  describe("Constants", () => {
    it("Exports expected constants", () => {
      expect(ERROR).toBeObject();
      expect(HTTP).toBeObject();
      expect(VALIDATE).toBeObject();
    });
    it("Does NOT export deprecated constants", () => {
      expect(NAME).toBeUndefined();
    });
  });
  describe("Errors", () => {
    it("Exposes ProjectError", () => {
      expect(BadGatewayError).toBeFunction();
      expect(BadRequestError).toBeFunction();
      expect(ConfigurationError).toBeFunction();
      expect(errorFromStatusCode).toBeFunction();
      expect(ForbiddenError).toBeFunction();
      expect(GatewayTimeoutError).toBeFunction();
      expect(GoneError).toBeFunction();
      expect(IllogicalError).toBeFunction();
      expect(InternalError).toBeFunction();
      expect(MethodNotAllowedError).toBeFunction();
      expect(MultiError).toBeFunction();
      expect(NotFoundError).toBeFunction();
      expect(NotImplementedError).toBeFunction();
      expect(ProjectError).toBeFunction();
      expect(ProjectMultiError).toBeFunction();
      expect(RejectedError).toBeFunction();
      expect(TeapotError).toBeFunction();
      expect(UnauthorizedError).toBeFunction();
      expect(UnavailableError).toBeFunction();
      expect(UnhandledError).toBeFunction();
      expect(UnreachableCodeError).toBeFunction();
    });
  });
  describe("Functions", () => {
    it("Exports functions from third parties", () => {
      expect(cloneDeep).toBeFunction();
      expect(uuid).toBeFunction();
    });
    it("Exports Jaypie convenience functions", () => {
      expect(envBoolean).toBeFunction();
      expect(force).toBeFunction();
      expect(getHeaderFrom).toBeFunction();
      expect(getObjectKeyCaseInsensitive).toBeFunction();
      expect(optional).toBeFunction();
      expect(placeholders).toBeFunction();
      expect(required).toBeFunction();
      expect(safeParseFloat).toBeFunction();
      expect(sleep).toBeFunction();
      expect(validate).toBeFunction();
    });
  });
  describe("Logging", () => {
    it("Exposes log", () => {
      expect(log).toBeObject();
      expect(log.init).toBeFunction();
    });
  });
  describe("Jaypie", () => {
    it("Exposes jaypieHandler", () => {
      expect(jaypieHandler).toBeFunction();
    });
  });
});
