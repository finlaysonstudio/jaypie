import { afterEach, beforeEach, describe, expect, it } from "vitest";

import HTTP from "../../http.lib.js";

import getHeaderFrom from "../getHeaderFrom.function.js";

//
//
// Mock constants
//

const MOCK = {
  KEY: "mockKey",
};

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

describe("GetHeaderFrom function", () => {
  it("Is a function", () => {
    expect(getHeaderFrom).toBeFunction();
  });
  it("Works", async () => {
    // console.log("HTTP :>> ", HTTP);
    const headers = {
      [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
    };
    const response = await getHeaderFrom(HTTP.HEADER.PROJECT.KEY, headers);
    expect(response).toBe(MOCK.KEY);
  });
  it("Searches in `header`", async () => {
    const event = {
      header: {
        [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
      },
    };
    const response = await getHeaderFrom(HTTP.HEADER.PROJECT.KEY, event);
    expect(response).toBe(MOCK.KEY);
  });
  it("Searches in `headers`", async () => {
    const event = {
      headers: {
        [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
      },
    };
    const response = await getHeaderFrom(HTTP.HEADER.PROJECT.KEY, event);
    expect(response).toBe(MOCK.KEY);
  });
  it("Returns `undefined` when not found in `headers`", async () => {
    const event = {
      header: {
        [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
      },
      headers: {
        [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
      },
      [HTTP.HEADER.PROJECT.KEY]: MOCK.KEY,
    };
    const response = await getHeaderFrom("bogus", event);
    expect(response).toBeUndefined();
  });

  it("Won't crash if searchObject is missing (undefined)", () => {
    getHeaderFrom("bogus");
  });

  it("Won't crash if searchObject is not an object", () => {
    getHeaderFrom("bogus", 12);
  });

  it("Won't crash if searchObject is null", () => {
    getHeaderFrom("bogus", null);
  });
});
