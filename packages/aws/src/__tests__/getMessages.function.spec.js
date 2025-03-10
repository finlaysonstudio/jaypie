// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import getMessages from "../getMessages.function.js";

//
//
// Mock constants
//

const MOCK = {
  BRIDGE: {
    EVENT: [
      {
        messageId: "14023f22-fa41-441e-9179-41295baaf5fa",
        receiptHandle:
          "AQEBISZwmX7RjTLZMDuazzYBUzpBTy+gH+3vFFeQLs1PmWpmcMQ98eO0T5ODWQB9adY9Dm4aL+7OL9zjB9Lfwn2sXG50IQoz0SwBXut6r3tDYFtNnhgmzuYeXrxdyKojA8NfDuu+X02HKA/Cn9RJNBCh7vVD8WDYzD1DQMIbNHCCJ645bXFNEgicjFzgW/cl0g07jnND9KYYjYnYewxC8ei8QKDbL4gKDOoz/AQB3kG6zlybB+EkLBAeQXSH7YaVtYFdvjq1mem0kHylZ2ciHouQk+c2c0NZpeXPAEGIY2sXGKxJTV2nyOWGGbx4yXRCYJfTE9NoYy89/Oz7ytb8Tg/yaeoF+zgOkUtO1xKGu8xfuLIkk7WirYcObed+sMuO1wr+",
        body: '{"project":"mayhem","data":"hello world"}',
        attributes: {
          // ...
        },
        md5OfBody: "1234567890abcdef1234567890abcdef",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
        awsRegion: "MOCK-REGION-1",
      },
    ],
  },
  SNS: {
    EVENT: {
      Records: [
        {
          EventSource: "aws:sns",
          EventVersion: "1.0",
          Sns: {
            Message: '{"project":"mayhem","data":"hello world"}',
          },
        },
      ],
    },
  },
  SQS: {
    EVENT: {
      Records: [
        {
          messageId: "14023f22-fa41-441e-9179-41295baaf5fa",
          receiptHandle:
            "AQEBISZwmX7RjTLZMDuazzYBUzpBTy+gH+3vFFeQLs1PmWpmcMQ98eO0T5ODWQB9adY9Dm4aL+7OL9zjB9Lfwn2sXG50IQoz0SwBXut6r3tDYFtNnhgmzuYeXrxdyKojA8NfDuu+X02HKA/Cn9RJNBCh7vVD8WDYzD1DQMIbNHCCJ645bXFNEgicjFzgW/cl0g07jnND9KYYjYnYewxC8ei8QKDbL4gKDOoz/AQB3kG6zlybB+EkLBAeQXSH7YaVtYFdvjq1mem0kHylZ2ciHouQk+c2c0NZpeXPAEGIY2sXGKxJTV2nyOWGGbx4yXRCYJfTE9NoYy89/Oz7ytb8Tg/yaeoF+zgOkUtO1xKGu8xfuLIkk7WirYcObed+sMuO1wr+",
          body: '{"project":"mayhem","data":"hello world"}',
          attributes: {
            // ...
          },
          messageAttributes: {},
          md5OfBody: "1234567890abcdef1234567890abcdef",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
          awsRegion: "MOCK-REGION-1",
        },
      ],
    },
  },
};

//
//
// Mock modules
//

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

describe("Get Messages Function", () => {
  it("Works", () => {
    const response = getMessages();
    expect(response).not.toBeUndefined();
  });
  it("Returns an array", () => {
    const response = getMessages();
    expect(response).toBeArray();
    expect(response).toHaveLength(0);
  });
  it("Parses SQS events", () => {
    const response = getMessages(MOCK.SQS.EVENT);
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toBeObject();
    expect(response[0]).toContainKeys(["project", "data"]);
  });
  it("Parses SNS events", () => {
    const response = getMessages(MOCK.SNS.EVENT);
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toBeObject();
    expect(response[0]).toContainKeys(["project", "data"]);
  });
  it("Parses event bridge events", () => {
    const response = getMessages(MOCK.BRIDGE.EVENT);
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toBeObject();
    expect(response[0]).toContainKeys(["project", "data"]);
  });
  it("Returns the body if it is not parsable", () => {
    const response = getMessages({ Records: [{ body: "hello world" }] });
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toBe("hello world");
  });
  it("Handles a single object event", () => {
    const singleEvent = { project: "mayhem", data: "hello world" };
    const response = getMessages(singleEvent);
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toEqual({ project: "mayhem", data: "hello world" });
  });
  it("Handles a single object event with unparseable body", () => {
    // obsolete test
    const singleEvent = { body: "not json" };
    const response = getMessages(singleEvent);
    expect(response).toBeArray();
    expect(response).toHaveLength(1);
    expect(response[0]).toEqual({ body: "not json" });
  });
  it("Throws ConfigurationError when event is not an object", () => {
    expect(() => getMessages("not an object")).toThrowConfigurationError();
    expect(() => getMessages(null)).toThrowConfigurationError();
    expect(() => getMessages(123)).toThrowConfigurationError();
  });
});
