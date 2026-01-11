import { describe, expect, it } from "vitest";

// Subject
import { lambdaHandler, lambdaStreamHandler } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports lambdaHandler", () => {
    expect(lambdaHandler).not.toBeUndefined();
    expect(lambdaHandler).toBeFunction();
  });
  it("Exports lambdaStreamHandler", () => {
    expect(lambdaStreamHandler).not.toBeUndefined();
    expect(lambdaStreamHandler).toBeFunction();
  });
});
