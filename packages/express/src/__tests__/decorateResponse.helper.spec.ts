import type { Response } from "express";
import { HTTP, JAYPIE } from "@jaypie/kit";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";

import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";

// Subject
import decorateResponse from "../decorateResponse.helper.js";

//
//
// Mock constants
//

const MOCK = {
  ENV: "MOCK_ENV",
  HANDLER: "MOCK_HANDLER",
  KEY: "MOCK_KEY",
  VERSION: "MOCK_VERSION",
};

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");

beforeEach(() => {
  (
    getCurrentInvokeUuid as MockedFunction<typeof getCurrentInvokeUuid>
  ).mockReturnValue("MOCK_UUID");
  delete process.env.PROJECT_ENV;
  delete process.env.PROJECT_VERSION;
});

afterEach(() => {
  vi.clearAllMocks();
});

class MockExpressResponse {
  _headers: Record<string, string>;

  constructor() {
    this._headers = {};
  }

  get(key: string): string | undefined {
    return this._headers[key.toLowerCase()];
  }

  set(key: string, value: string): void {
    this._headers[key.toLowerCase()] = value;
  }
}

//
//
// Run tests
//

describe("Decorate response util", () => {
  it("Works", () => {
    expect(decorateResponse).toBeFunction();
  });
  it("Returns when a non-objects are passed in (or null, which is an object)", () => {
    expect(() =>
      decorateResponse(undefined as unknown as Response),
    ).not.toThrow();
    expect(() =>
      decorateResponse("Hello." as unknown as Response),
    ).not.toThrow();
    expect(() => decorateResponse(42 as unknown as Response)).not.toThrow();
    expect(() => decorateResponse(true as unknown as Response)).not.toThrow();
    expect(() => decorateResponse(null as unknown as Response)).not.toThrow();
  });
  it("Returns when no headers object is present", () => {
    // No headers object is often passed in mocking and tests
    const res = {} as Response;
    decorateResponse(res);
    // Expect res to still be an empty object
    expect(res).toEqual({});
  });
  describe("Decorating headers", () => {
    describe("Project invoke", () => {
      it("Adds the project invoke", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.INVOCATION,
          ),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.INVOCATION,
          ),
        ).not.toBeUndefined();
      });
    });
    describe("Powered by", () => {
      it("Adds the powered by", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).toBeUndefined();
        decorateResponse(res);
        // DIAGNOSTIC: Header includes version suffix during #178 investigation
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).toMatch(
          new RegExp(`^${JAYPIE.LIB.EXPRESS}(@\\d+\\.\\d+\\.\\d+(-dev)?)?$`),
        );
      });
      it("Adds the powered by and overrides the Express default", () => {
        const res = new MockExpressResponse() as unknown as Response;
        (res as unknown as MockExpressResponse).set(
          HTTP.HEADER.POWERED_BY,
          "Express",
        );
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).not.toBeUndefined();
        decorateResponse(res);
        // DIAGNOSTIC: Header includes version suffix during #178 investigation
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).toMatch(
          new RegExp(`^${JAYPIE.LIB.EXPRESS}(@\\d+\\.\\d+\\.\\d+(-dev)?)?$`),
        );
      });
      it("Will not add powered by if one exists", () => {
        const res = new MockExpressResponse() as unknown as Response;
        (res as unknown as MockExpressResponse).set(
          HTTP.HEADER.POWERED_BY,
          "Some other value",
        );
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).not.toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.POWERED_BY),
        ).toEqual("Some other value");
      });
    });
    describe("Project environment", () => {
      it("Adds the project environment if it is present", () => {
        process.env.PROJECT_ENV = MOCK.ENV;
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.ENVIRONMENT,
          ),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.ENVIRONMENT,
          ),
        ).not.toBeUndefined();
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.ENVIRONMENT,
          ),
        ).toEqual(MOCK.ENV);
      });
      it("Does not adds the project environment if it is not present", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.ENVIRONMENT,
          ),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.ENVIRONMENT,
          ),
        ).toBeUndefined();
      });
    });
    describe("Project handler name", () => {
      it("Adds the project handler if it is present", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.HANDLER,
          ),
        ).toBeUndefined();
        decorateResponse(res, { handler: MOCK.HANDLER });
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.HANDLER,
          ),
        ).not.toBeUndefined();
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.HANDLER,
          ),
        ).toEqual(MOCK.HANDLER);
      });
      it("Does not adds the project handler if it is not present", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.HANDLER,
          ),
        ).toBeUndefined();
        decorateResponse(res, {});
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.HANDLER,
          ),
        ).toBeUndefined();
      });
    });
    describe("Project key", () => {
      it("Adds the project key if it is present", () => {
        process.env.PROJECT_KEY = MOCK.KEY;
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.PROJECT.KEY),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.PROJECT.KEY),
        ).not.toBeUndefined();
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.PROJECT.KEY),
        ).toEqual(MOCK.KEY);
      });
      it("Does not adds the project key if it is not present", () => {
        delete process.env.PROJECT_KEY;
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.PROJECT.KEY),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(HTTP.HEADER.PROJECT.KEY),
        ).toBeUndefined();
      });
    });
    describe("Project version", () => {
      it("Adds the project version if it is present", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toBeUndefined();
        decorateResponse(res, { version: MOCK.VERSION });
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).not.toBeUndefined();
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toEqual(MOCK.VERSION);
      });
      it("Does not adds the project version if it is not present", () => {
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toBeUndefined();
        decorateResponse(res, {});
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toBeUndefined();
      });
      it("Finds the version in the environment", () => {
        process.env.PROJECT_VERSION = MOCK.VERSION;
        const res = new MockExpressResponse() as unknown as Response;
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toBeUndefined();
        decorateResponse(res);
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).not.toBeUndefined();
        expect(
          (res as unknown as MockExpressResponse).get(
            HTTP.HEADER.PROJECT.VERSION,
          ),
        ).toEqual(MOCK.VERSION);
      });
    });
  });
});
