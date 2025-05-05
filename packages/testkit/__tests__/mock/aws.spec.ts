import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMessages,
  getSecret,
  sendMessage,
  uploadToS3,
  downloadFromS3,
} from "../../src/mock/aws";

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

  describe("uploadToS3", () => {
    it("should return mock S3 URL by default", async () => {
      const result = await uploadToS3("bucket", "key", "data");
      expect(result).toBe("https://mock-s3-url.com");
    });

    it("should track calls with bucket, key and data", async () => {
      const bucket = "test-bucket";
      const key = "path/to/file.json";
      const data = { test: true };

      await uploadToS3(bucket, key, data);

      expect(uploadToS3.mock.calls.length).toBe(1);
      expect(uploadToS3.mock.calls[0][0]).toBe(bucket);
      expect(uploadToS3.mock.calls[0][1]).toBe(key);
      expect(uploadToS3.mock.calls[0][2]).toBe(data);
    });
  });

  describe("downloadFromS3", () => {
    it("should return mock data as buffer by default", async () => {
      const result = await downloadFromS3("bucket", "key");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe("mock-data");
    });

    it("should track calls with bucket and key", async () => {
      const bucket = "test-bucket";
      const key = "path/to/file.json";

      await downloadFromS3(bucket, key);

      expect(downloadFromS3.mock.calls.length).toBe(1);
      expect(downloadFromS3.mock.calls[0][0]).toBe(bucket);
      expect(downloadFromS3.mock.calls[0][1]).toBe(key);
    });
  });
});
