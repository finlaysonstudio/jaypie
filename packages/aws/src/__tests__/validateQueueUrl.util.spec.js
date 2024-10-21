import { describe, expect, it } from "vitest";

// Subject
import validateQueueUrl from "../validateQueueUrl.util.js";

//
//
// Run tests
//

describe("Validate Queue Url Util", () => {
  it("Works", () => {
    const response = validateQueueUrl(
      "https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue",
    );
    expect(response).not.toBeUndefined();
    expect(response).toBeTrue();
  });
});
