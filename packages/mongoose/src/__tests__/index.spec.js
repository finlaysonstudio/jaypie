import { describe, expect, it } from "vitest";

// Subject
import { connect, connectFromSecretEnv } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Works", () => {
    expect(connect).toBeFunction();
    expect(connectFromSecretEnv).toBeFunction();
  });
});
