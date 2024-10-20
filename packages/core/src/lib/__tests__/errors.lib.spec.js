// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  IllogicalError,
  InternalError,
  isJaypieError,
  MethodNotAllowedError,
  MultiError,
  NotFoundError,
  NotImplementedError,
  RejectedError,
  TeapotError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
} from "../errors.lib.js";

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

describe("Arguments Lib", () => {
  it("Exports what we expect", () => {
    expect(BadGatewayError).toBeFunction();
    expect(BadRequestError).toBeFunction();
    expect(ConfigurationError).toBeFunction();
    expect(ForbiddenError).toBeFunction();
    expect(GatewayTimeoutError).toBeFunction();
    expect(GoneError).toBeFunction();
    expect(IllogicalError).toBeFunction();
    expect(InternalError).toBeFunction();
    expect(isJaypieError).toBeFunction();
    expect(MethodNotAllowedError).toBeFunction();
    expect(MultiError).toBeFunction();
    expect(NotFoundError).toBeFunction();
    expect(NotImplementedError).toBeFunction();
    expect(RejectedError).toBeFunction();
    expect(TeapotError).toBeFunction();
    expect(UnavailableError).toBeFunction();
    expect(UnhandledError).toBeFunction();
    expect(UnreachableCodeError).toBeFunction();
  });
});
