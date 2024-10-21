import { describe, expect, it } from "vitest";

// Subject
import {
  getMessages,
  getSecret,
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
    expect(sendBatchMessages).toBeFunction();
    expect(sendMessage).toBeFunction();
  });
});
