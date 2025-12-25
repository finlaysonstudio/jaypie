import { describe, expect, it } from "vitest";

// Subject
import {
  getMessages,
  getSecret,
  loadEnvSecrets,
  sendBatchMessages,
  sendMessage,
} from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports functions", () => {
    expect(getMessages).toBeFunction();
    expect(getSecret).toBeFunction();
    expect(loadEnvSecrets).toBeFunction();
    expect(sendBatchMessages).toBeFunction();
    expect(sendMessage).toBeFunction();
  });
});
