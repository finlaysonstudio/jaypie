import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMessages, getSecret, sendMessage } from "../aws";

// import * as aws from "@jaypie/aws";

describe("AWS Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMessages", () => {
    it("should return empty array by default", async () => {
      const result = await getMessages("https://sqs.example.com/queue");
      expect(result).toEqual([]);
    });

    it("should track calls with queue URL", async () => {
      const queueUrl = "https://sqs.example.com/queue";
      await getMessages(queueUrl);

      expect(getMessages.mock.calls.length).toBe(1);
      expect(getMessages.mock.calls[0][0]).toBe(queueUrl);
    });

    it("should allow customizing return value", async () => {
      const customMessages = [{ id: "1", body: "test" }];
      getMessages.mockResolvedValueOnce(customMessages);

      const result = await getMessages("queue-url");
      expect(result).toEqual(customMessages);
    });
  });

  describe("getSecret", () => {
    it("should return mock secret value by default", async () => {
      const result = await getSecret("test-secret");
      expect(result).toBe("mock-secret-value");
    });

    it("should track calls with secret name", async () => {
      const secretName = "api-key";
      await getSecret(secretName);

      expect(getSecret.mock.calls.length).toBe(1);
      expect(getSecret.mock.calls[0][0]).toBe(secretName);
    });
  });

  describe("sendMessage", () => {
    it("should resolve successfully", async () => {
      await expect(
        sendMessage("queue-url", { data: "test" }),
      ).resolves.toBeUndefined();
    });

    it("should track calls with queue URL and message", async () => {
      const queueUrl = "queue-url";
      const message = { data: "test" };

      await sendMessage(queueUrl, message);

      expect(sendMessage.mock.calls.length).toBe(1);
      expect(sendMessage.mock.calls[0][0]).toBe(queueUrl);
      expect(sendMessage.mock.calls[0][1]).toBe(message);
    });
  });
});
