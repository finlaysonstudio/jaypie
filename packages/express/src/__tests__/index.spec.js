import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import * as index from "../index.js";

//
//
// Mock modules
//

// vi.mock("../file.js");
// vi.mock("module");

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Index", () => {
  it("Works", async () => {
    expect(index).toBeDefined();
    expect(index).toBeObject();
  });
  it("Exports constants we expect", () => {
    expect(index.EXPRESS).toBeObject();
  });
  it("Exports functions we expect", () => {
    expect(index.expressHandler).toBeFunction();
    expect(index.expressHttpCodeHandler).toBeFunction();
    expect(index.echoRoute).toBeFunction();
    expect(index.forbiddenRoute).toBeFunction();
    expect(index.goneRoute).toBeFunction();
    expect(index.noContentRoute).toBeFunction();
    expect(index.notFoundRoute).toBeFunction();
    expect(index.notImplementedRoute).toBeFunction();
  });
});
