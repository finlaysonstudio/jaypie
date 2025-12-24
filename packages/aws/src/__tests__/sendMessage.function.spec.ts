import { beforeAll, afterEach, describe, expect, it, vi, Mock } from "vitest";

// Mock
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import validateQueueUrl from "../validateQueueUrl.util.js";

// Subject
import sendMessage from "../sendMessage.function.js";

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
  SendMessageCommand: vi.fn(),
  SQSClient: vi.fn(),
}));

vi.mock("../validateQueueUrl.util.js");

beforeAll(() => {
  (validateQueueUrl as Mock).mockResolvedValue(true);
  (SQSClient as Mock).mockReturnValue({ send: mockSqsClientSend });
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

describe("Send Message Function", () => {
  describe("Base Cases", () => {
    it("Works with params object", async () => {
      const response = await sendMessage({
        body: MOCK.MESSAGE,
        queueUrl: MOCK.QUEUE_URL,
      });
      expect(response).not.toBeUndefined();
    });
    it("Works with body and params", async () => {
      const response = await sendMessage(MOCK.MESSAGE, {
        queueUrl: MOCK.QUEUE_URL,
      });
      expect(response).not.toBeUndefined();
    });
    it("Works with complex body and params", async () => {
      const response = await sendMessage(MOCK.BODY, {
        queueUrl: MOCK.QUEUE_URL,
      });
      expect(response).not.toBeUndefined();
    });
    it("Works with complex body without params and CDK_ENV_QUEUE_URL", async () => {
      process.env.CDK_ENV_QUEUE_URL = MOCK.QUEUE_URL;
      const response = await sendMessage(MOCK.BODY);
      expect(response).not.toBeUndefined();
      delete process.env.CDK_ENV_QUEUE_URL;
    });
  });
  describe("Error Cases", () => {
    it("Throws if delaySeconds is not number", async () => {
      try {
        await sendMessage({
          body: MOCK.MESSAGE,
          delaySeconds: "string" as unknown as number,
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
    it("Throws if messageBody is empty", async () => {
      try {
        await sendMessage({
          body: "",
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
    it("Handles authorization errors appropriately", async () => {
      const authError = new Error("Access Denied") as Error & { name: string };
      authError.name = "AccessDeniedException";
      mockSqsClientSend.mockRejectedValueOnce(authError);

      try {
        await sendMessage({
          body: MOCK.MESSAGE,
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
    it("Handles general SQS errors appropriately", async () => {
      const sqsError = new Error("Service Unavailable") as Error & {
        name: string;
      };
      sqsError.name = "ServiceUnavailable";
      mockSqsClientSend.mockRejectedValueOnce(sqsError);

      try {
        await sendMessage({
          body: MOCK.MESSAGE,
          queueUrl: MOCK.QUEUE_URL,
        });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
  });
  describe("Features", () => {
    it("Sends a standard message with params object", async () => {
      const response = (await sendMessage({
        body: MOCK.MESSAGE,
        queueUrl: MOCK.QUEUE_URL,
      })) as { MessageId: string };
      expect(response).not.toBeUndefined();
      expect(response.MessageId).toBe("MOCK_SQS_RESULT_MESSAGE_ID");
      expect(SendMessageCommand).toHaveBeenCalledWith({
        MessageBody: MOCK.MESSAGE,
        QueueUrl: MOCK.QUEUE_URL,
      });
      expect(SQSClient).toHaveBeenCalled();
      expect(mockSqsClientSend).toHaveBeenCalled();
    });
    it("Sends a standard message with body and params", async () => {
      const response = (await sendMessage(MOCK.MESSAGE, {
        queueUrl: MOCK.QUEUE_URL,
      })) as { MessageId: string };
      expect(response).not.toBeUndefined();
      expect(response.MessageId).toBe("MOCK_SQS_RESULT_MESSAGE_ID");
      expect(SendMessageCommand).toHaveBeenCalledWith({
        MessageBody: MOCK.MESSAGE,
        QueueUrl: MOCK.QUEUE_URL,
      });
      expect(SQSClient).toHaveBeenCalled();
      expect(mockSqsClientSend).toHaveBeenCalled();
    });
    it("Sends a FIFO message if queueUrl ends in `.fifo`", async () => {
      const response = (await sendMessage({
        body: MOCK.BODY,
        queueUrl: MOCK.FIFO_QUEUE_URL,
      })) as { MessageId: string };
      expect(response).not.toBeUndefined();
      expect(response.MessageId).toBe("MOCK_SQS_RESULT_MESSAGE_ID");
      expect(SendMessageCommand).toHaveBeenCalledWith({
        MessageBody: JSON.stringify(MOCK.BODY),
        QueueUrl: MOCK.FIFO_QUEUE_URL,
        MessageGroupId: expect.any(String),
        MessageDeduplicationId: expect.any(String),
      });
    });
    it("Includes messageAttributes if provided", async () => {
      const messageAttributes = { MOCK: "MESSAGE_ATTRIBUTES" } as unknown as {
        MOCK: string;
      };
      const response = (await sendMessage({
        body: MOCK.BODY,
        messageAttributes: messageAttributes as never,
        queueUrl: MOCK.FIFO_QUEUE_URL,
      })) as { MessageId: string };
      expect(response).not.toBeUndefined();
      expect(response.MessageId).toBe("MOCK_SQS_RESULT_MESSAGE_ID");
      expect(SendMessageCommand).toHaveBeenCalledWith({
        MessageAttributes: messageAttributes,
        MessageBody: JSON.stringify(MOCK.BODY),
        MessageDeduplicationId: expect.any(String),
        MessageGroupId: expect.any(String),
        QueueUrl: MOCK.FIFO_QUEUE_URL,
      });
    });
    it("Includes delaySeconds if provided", async () => {
      const delaySeconds = 100;
      const response = (await sendMessage({
        body: MOCK.BODY,
        delaySeconds,
        queueUrl: MOCK.FIFO_QUEUE_URL,
      })) as { MessageId: string };
      expect(response).not.toBeUndefined();
      expect(response.MessageId).toBe("MOCK_SQS_RESULT_MESSAGE_ID");
      expect(SendMessageCommand).toHaveBeenCalledWith({
        DelaySeconds: delaySeconds,
        MessageBody: JSON.stringify(MOCK.BODY),
        MessageDeduplicationId: expect.any(String),
        MessageGroupId: expect.any(String),
        QueueUrl: MOCK.FIFO_QUEUE_URL,
      });
    });
  });
});
