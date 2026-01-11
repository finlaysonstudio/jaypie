import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import getS3FileBuffer from "../getS3FileBuffer.function.js";

//
//
// Mock constants
//

const MOCK = {
  BUCKET: "test-bucket",
  KEY: "test-key.pdf",
  FILE_CONTENT: Buffer.from("mock file content"),
};

//
//
// Mock modules
//

// Mock AWS SDK S3 Client
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: vi.fn((params) => params),
  S3Client: vi.fn(() => ({
    send: mockSend,
  })),
}));

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  vi.clearAllMocks();

  // Default mock implementation that returns a valid readable stream
  mockSend.mockResolvedValue({
    Body: {
      async *[Symbol.asyncIterator]() {
        yield MOCK.FILE_CONTENT;
      },
    },
  });
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("Get S3 File Buffer Function", () => {
  it("Works", async () => {
    const response = await getS3FileBuffer({
      bucket: MOCK.BUCKET,
      key: MOCK.KEY,
    });
    expect(response).not.toBeUndefined();
    expect(Buffer.isBuffer(response)).toBe(true);
  });

  describe("Error Cases", () => {
    it("Throws if no bucket provided", async () => {
      await expect(
        getS3FileBuffer({ bucket: "", key: MOCK.KEY }),
      ).rejects.toThrow("No S3 bucket provided");
    });

    it("Throws if no key provided", async () => {
      await expect(
        getS3FileBuffer({ bucket: MOCK.BUCKET, key: "" }),
      ).rejects.toThrow("No S3 key provided");
    });

    it("Throws if response has no Body", async () => {
      mockSend.mockResolvedValue({});
      await expect(
        getS3FileBuffer({ bucket: MOCK.BUCKET, key: MOCK.KEY }),
      ).rejects.toThrow(
        `Failed to retrieve file content from S3: ${MOCK.BUCKET}/${MOCK.KEY}`,
      );
    });

    it("Propagates S3 errors", async () => {
      mockSend.mockRejectedValue(new Error("Access Denied"));
      await expect(
        getS3FileBuffer({ bucket: MOCK.BUCKET, key: MOCK.KEY }),
      ).rejects.toThrow("Access Denied");
    });
  });

  describe("Features", () => {
    it("Passes bucket and key to GetObjectCommand", async () => {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");

      await getS3FileBuffer({ bucket: MOCK.BUCKET, key: MOCK.KEY });

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: MOCK.BUCKET,
        Key: MOCK.KEY,
      });
    });

    it("Returns buffer with correct content", async () => {
      const response = await getS3FileBuffer({
        bucket: MOCK.BUCKET,
        key: MOCK.KEY,
      });

      expect(response.toString()).toBe(MOCK.FILE_CONTENT.toString());
    });

    it("Handles multiple chunks from stream", async () => {
      const chunk1 = Buffer.from("first ");
      const chunk2 = Buffer.from("second");

      mockSend.mockResolvedValue({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield chunk1;
            yield chunk2;
          },
        },
      });

      const response = await getS3FileBuffer({
        bucket: MOCK.BUCKET,
        key: MOCK.KEY,
      });

      expect(response.toString()).toBe("first second");
    });
  });
});
