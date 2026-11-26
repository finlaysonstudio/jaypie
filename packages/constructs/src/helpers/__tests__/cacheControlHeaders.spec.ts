import { describe, expect, it } from "vitest";

import { cacheControlHeaders } from "../cacheControlHeaders";

describe("cacheControlHeaders", () => {
  it("is a function", () => {
    expect(cacheControlHeaders).toBeFunction();
  });

  it("overrides Cache-Control with a string", () => {
    expect(cacheControlHeaders("no-store")).toEqual([
      { header: "Cache-Control", override: true, value: "no-store" },
    ]);
  });

  it("returns no headers for false", () => {
    expect(cacheControlHeaders(false)).toEqual([]);
  });
});
