import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

// Mock
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import validateQueueUrl from "../validateQueueUrl.util.js";

// Subject
import sendBatchMessages from "../sendBatchMessages.function.js";

//
//
// Mock constants
//

const MOCK = {
  BODY: { MOCK: "BODY_JSON" },
  FIFO_QUEUE_URL: "MOCK_QUEUE_URL.fifo",
  MESSAGE: "MOCK_MESSAGE",
  QUEUE_URL: "MOCK_QUEUE_URL",
};

//
//
// Mock modules
//

const mockSqsClientSend = vi.fn();
vi.mock("@aws-sdk/client-sqs", async () => ({
  SendMessageBatchCommand: vi.fn(),
  SQSClient: vi.fn(),
}));

vi.mock("../validateQueueUrl.util.js");

beforeAll(() => {
  validateQueueUrl.mockResolvedValue(true);
  SQSClient.mockReturnValue({ send: mockSqsClientSend });
  mockSqsClientSend.mockResolvedValue({
    MessageId: "MOCK_SQS_RESULT_MESSAGE_ID",
  });
});
afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Send Batch Messages Function", () => {
  it("Works", async () => {
    const response = await sendBatchMessages({
      messages: [MOCK.MESSAGE],
      queueUrl: MOCK.QUEUE_URL,
    });
    expect(response).not.toBeUndefined();
  });
  describe("Error Cases", () => {
    it("Throws if messages is not an array", async () => {
      await expect(
        sendBatchMessages({ messages: "MOCK_MESSAGES" }),
      ).rejects.toThrow();
    });

    it("Handles authorization errors appropriately", async () => {
      const authError = new Error("Access Denied");
      authError.name = "AccessDeniedException";
      mockSqsClientSend.mockRejectedValueOnce(authError);

      try {
        await sendBatchMessages({
          messages: [MOCK.MESSAGE],
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });

    it("Handles general SQS errors appropriately", async () => {
      const sqsError = new Error("Service Unavailable");
      sqsError.name = "ServiceUnavailable";
      mockSqsClientSend.mockRejectedValueOnce(sqsError);

      try {
        await sendBatchMessages({
          messages: [MOCK.MESSAGE],
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });

    it("Throws if delaySeconds is not number", async () => {
      try {
        await sendBatchMessages({
          messages: [MOCK.MESSAGE],
          delaySeconds: "string",
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
  });
  describe("Features", () => {
    it("Chunks messages into batches of max 10", async () => {
      const messages = Array(26).fill({ MOCK: "BATCH_MESSAGES" });
      await sendBatchMessages({
        messages,
        queueUrl: MOCK.QUEUE_URL,
      });
      expect(SendMessageBatchCommand).toHaveBeenCalledTimes(3);
      expect(SendMessageBatchCommand.mock.calls[0][0].Entries).toBeArrayOfSize(
        10,
      );
      expect(SendMessageBatchCommand.mock.calls[1][0].Entries).toBeArrayOfSize(
        10,
      );
      expect(SendMessageBatchCommand.mock.calls[2][0].Entries).toBeArrayOfSize(
        6,
      );
    });
    it("Sends a FIFO message if queueUrl ends in `.fifo`", async () => {
      await sendBatchMessages({
        messages: [MOCK.BODY],
        queueUrl: MOCK.FIFO_QUEUE_URL,
      });
      expect(SendMessageBatchCommand).toHaveBeenCalled();
      const call = SendMessageBatchCommand.mock.calls[0][0];
      expect(call.QueueUrl).toBe(MOCK.FIFO_QUEUE_URL);
      expect(call.Entries).toBeArrayOfSize(1);
      expect(call.Entries[0]).toMatchObject({
        Id: expect.any(String),
        MessageBody: JSON.stringify(MOCK.BODY),
        MessageGroupId: expect.any(String),
        MessageDeduplicationId: expect.any(String),
      });
    });
    it("Sends a standard message by default", async () => {
      await sendBatchMessages({
        messages: [MOCK.MESSAGE],
        queueUrl: MOCK.QUEUE_URL,
      });
      expect(SendMessageBatchCommand).toHaveBeenCalled();
      const call = SendMessageBatchCommand.mock.calls[0][0];
      expect(call.QueueUrl).toBe(MOCK.QUEUE_URL);
      expect(call.Entries).toBeArrayOfSize(1);
      expect(call.Entries[0]).toMatchObject({
        Id: expect.any(String),
        MessageBody: MOCK.MESSAGE,
      });
      expect(call.Entries[0]).not.toHaveProperty("MessageGroupId");
      expect(call.Entries[0]).not.toHaveProperty("MessageDeduplicationId");
    });
  });
});
