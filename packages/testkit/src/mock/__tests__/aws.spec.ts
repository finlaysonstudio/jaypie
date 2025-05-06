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

describe("AWS Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("getMessages is a function", () => {
      expect(typeof getMessages).toBe("function");
    });

    it("getSecret is a function", () => {
      expect(typeof getSecret).toBe("function");
    });

    it("sendMessage is a function", () => {
      expect(typeof sendMessage).toBe("function");
    });

    it("getEnvSecret is a function", () => {
      expect(typeof getEnvSecret).toBe("function");
    });

    it("getSingletonMessage is a function", () => {
      expect(typeof getSingletonMessage).toBe("function");
    });

    it("getTextractJob is a function", () => {
      expect(typeof getTextractJob).toBe("function");
    });

    it("sendBatchMessages is a function", () => {
      expect(typeof sendBatchMessages).toBe("function");
    });

    it("sendTextractJob is a function", () => {
      expect(typeof sendTextractJob).toBe("function");
    });
  });

  describe("Error Conditions", () => {
    it("sendTextractJob throws error for missing parameters", async () => {
      await expect(async () => {
        await sendTextractJob("", "");
      }).rejects.toThrow("Bucket and key are required");
    });
  });

  describe("Happy Paths", () => {
    it("getMessages returns empty array by default", async () => {
      const result = await getMessages("https://sqs.example.com/queue");
      expect(result).toEqual([]);
    });

    it("getSecret returns mock secret value by default", async () => {
      const result = await getSecret("test-secret");
      expect(result).toBe("mock-secret-value");
    });

    it("sendMessage resolves successfully", async () => {
      await expect(
        sendMessage("queue-url", { data: "test" }),
      ).resolves.toBeUndefined();
    });

    it("getEnvSecret returns formatted mock value", async () => {
      const result = await getEnvSecret("API_KEY");
      expect(result).toBe("_MOCK_ENV_SECRET_[AWS][API_KEY]");
    });

    it("getSingletonMessage extracts first record from event", () => {
      const event = { Records: [{ messageId: "123" }] };
      const result = getSingletonMessage(event);
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
      expect(result).toHaveProperty("count", 2);
    });

    it("sendTextractJob returns array with job ID", async () => {
      const result = await sendTextractJob("my-bucket", "document.pdf");
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
