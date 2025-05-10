import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMessages,
  getSecret,
  sendMessage,
  getEnvSecret,
  getSingletonMessage,
  getTextractJob,
  sendBatchMessages,
  sendTextractJob,
} from "../aws";
import sqsTestRecords from "../../sqsTestRecords.function";

describe("AWS Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("getMessages is a function", () => {
      expect(getMessages).toBeMockFunction();
    });

    it("getSecret is a function", () => {
      expect(getSecret).toBeMockFunction();
    });

    it("sendMessage is a function", () => {
      expect(sendMessage).toBeMockFunction();
    });

    it("getEnvSecret is a function", () => {
      expect(getEnvSecret).toBeMockFunction();
    });

    it("getSingletonMessage is a function", () => {
      expect(getSingletonMessage).toBeMockFunction();
    });

    it("getTextractJob is a function", () => {
      expect(getTextractJob).toBeMockFunction();
    });

    it("sendBatchMessages is a function", () => {
      expect(sendBatchMessages).toBeMockFunction();
    });

    it("sendTextractJob is a function", () => {
      expect(sendTextractJob).toBeMockFunction();
    });
  });

  describe("Error Conditions", () => {
    it("sendTextractJob throws error for missing parameters", async () => {
      await expect(async () => {
        await sendTextractJob({});
      }).rejects.toThrow("Bucket and key are required");
    });
  });

  describe("Happy Paths", () => {
    it("getMessages returns empty array by default", async () => {
      const result = await getMessages("https://sqs.example.com/queue");
      expect(result).toEqual([]);
    });

    it("getMessages returns empty array when no records", async () => {
      const result = await getMessages();
      expect(result).toEqual([]);
    });

    it("getMessages returns mock messages", async () => {
      getMessages.mockResolvedValueOnce([{ messageId: "123" }]);
      const result = await getMessages();
      expect(result).toEqual([{ messageId: "123" }]);
    });

    it("getMessages returns mock record messages", async () => {
      const mockRecords = sqsTestRecords({ messageId: "123" });
      const result = await getMessages(mockRecords);
      expect(result).toEqual([{ messageId: "123" }]);
    });

    it("getSecret returns mock secret value by default", async () => {
      const result = await getSecret("test-secret");
      expect(result).toBe("mock-secret-value");
    });

    it("sendMessage resolves successfully", async () => {
      await expect(sendMessage("queue-url", { data: "test" })).resolves.toEqual(
        { MessageId: "mock-message-id" },
      );
    });

    it("getEnvSecret returns formatted mock value", async () => {
      const result = await getEnvSecret("API_KEY");
      expect(result).toBe("_MOCK_ENV_SECRET_[AWS][API_KEY]");
    });

    it("getSingletonMessage extracts first record from event", () => {
      const mockRecords = sqsTestRecords({ messageId: "123" });
      const result = getSingletonMessage(mockRecords);
      expect(result).toEqual({ messageId: "123" });
    });

    it("getSingletonMessage provides fallback for invalid events", () => {
      const result = getSingletonMessage(null);
      expect(result).toHaveProperty("value");
      expect(result.value).toContain("_MOCK_SINGLETON_MESSAGE_");
    });

    it("getTextractJob returns formatted mock response", async () => {
      const result = await getTextractJob("job-123");
      expect(result).toEqual({ value: "_MOCK_TEXTRACT_JOB_[job-123]" });
    });

    it("sendBatchMessages returns response with count", async () => {
      const messages = [{ id: 1 }, { id: 2 }];
      const result = await sendBatchMessages("queue-url", messages);
      expect(result).toBeTrue();
    });

    it("sendTextractJob returns array with job ID", async () => {
      const result = await sendTextractJob({
        bucket: "my-bucket",
        key: "document.pdf",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toContain("my-bucket");
      expect(result[0]).toContain("document.pdf");
    });
  });

  describe("Features", () => {
    it("getMessages allows customizing return value", async () => {
      const customMessages = [{ id: "1", body: "test" }];
      getMessages.mockResolvedValueOnce(customMessages);

      const result = await getMessages("queue-url");
      expect(result).toEqual(customMessages);
    });

    it("getMessages tracks calls with queue URL", async () => {
      const queueUrl = "https://sqs.example.com/queue";
      await getMessages(queueUrl);

      expect(getMessages.mock.calls.length).toBe(1);
      expect(getMessages.mock.calls[0][0]).toBe(queueUrl);
    });

    it("getSecret tracks calls with secret name", async () => {
      const secretName = "api-key";
      await getSecret(secretName);

      expect(getSecret.mock.calls.length).toBe(1);
      expect(getSecret.mock.calls[0][0]).toBe(secretName);
    });

    it("sendMessage tracks calls with queue URL and message", async () => {
      const queueUrl = "queue-url";
      const message = { data: "test" };

      await sendMessage(queueUrl, message);

      expect(sendMessage.mock.calls.length).toBe(1);
      expect(sendMessage.mock.calls[0][0]).toBe(queueUrl);
      expect(sendMessage.mock.calls[0][1]).toBe(message);
    });
  });
});

describe("Jaypie AWS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("Mocks expected function", () => {
    expect(getMessages).not.toHaveBeenCalled();
    expect(getSecret).not.toHaveBeenCalled();
    expect(sendBatchMessages).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("Mocks return appropriate values", async () => {
    //
    await expect(getSecret()).resolves.toBeString();
    await expect(sendBatchMessages()).resolves.toBeTrue();
    await expect(sendMessage()).resolves.toBeObject();
  });
  it("sqsTestRecords mock returns appropriate values", () => {
    // Arrange
    const testRecords = sqsTestRecords(
      { MessageId: 1, Body: "Hello, World!" },
      { MessageId: 2, Body: "Goodbye, World!" },
    );
    // Assure
    expect(getMessages).not.toHaveBeenCalled();
    expect(testRecords).toBeObject();
    expect(testRecords.Records).toBeArray();
    expect(testRecords.Records[0].body).toBeString();
    // Act
    const messages = getMessages(testRecords) as Array<any>;
    // Assert
    expect(getMessages).toHaveBeenCalled();
    expect(messages).toBeArray();
    expect(messages).toHaveLength(2);
    expect(messages[0].Body).toBe("Hello, World!");
    expect(messages[1].MessageId).toBe(2);
  });
});
