import { describe, expect, it } from "vitest";

// Subject
import { lambdaHandler, loadEnvSecrets } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports Function", () => {
    expect(lambdaHandler).not.toBeUndefined();
    expect(lambdaHandler).toBeFunction();
  });
  it("Exports loadEnvSecrets", () => {
    expect(loadEnvSecrets).not.toBeUndefined();
    expect(loadEnvSecrets).toBeFunction();
  });
});
