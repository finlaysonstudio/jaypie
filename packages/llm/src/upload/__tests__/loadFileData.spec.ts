import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "@jaypie/errors";

import { loadLocalFile } from "../loadLocalFile.js";
import { loadS3File } from "../loadS3File.js";
import { loadFileData } from "../resolveOperateInput.js";

//
//
// Mock
//

vi.mock("../loadLocalFile.js", () => ({
  loadLocalFile: vi.fn(),
}));

vi.mock("../loadS3File.js", () => ({
  loadS3File: vi.fn(),
}));

//
//
// Tests
//

describe("loadFileData", () => {
  const originalBucket = process.env.CDK_ENV_BUCKET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CDK_ENV_BUCKET;
  });

  afterEach(() => {
    if (originalBucket === undefined) {
      delete process.env.CDK_ENV_BUCKET;
    } else {
      process.env.CDK_ENV_BUCKET = originalBucket;
    }
  });

  describe("Base Cases", () => {
    it("decodes provided data", async () => {
      const buffer = await loadFileData({
        data: Buffer.from("hello").toString("base64"),
        file: "uploads/hello.txt",
      });
      expect(buffer.toString()).toBe("hello");
      expect(loadLocalFile).not.toHaveBeenCalled();
      expect(loadS3File).not.toHaveBeenCalled();
    });
  });

  describe("Error Conditions", () => {
    it("rejects empty data instead of loading the file", async () => {
      await expect(
        loadFileData({ data: "", file: "uploads/empty.pdf" }),
      ).rejects.toThrow(BadRequestError);
      expect(loadLocalFile).not.toHaveBeenCalled();
      expect(loadS3File).not.toHaveBeenCalled();
    });

    it("rejects empty data on an image", async () => {
      await expect(
        loadFileData({ data: "", image: "uploads/empty.png" }),
      ).rejects.toThrow(BadRequestError);
      expect(loadLocalFile).not.toHaveBeenCalled();
    });
  });

  describe("Features", () => {
    it("loads from S3 when data is absent and a bucket is set", async () => {
      vi.mocked(loadS3File).mockResolvedValue(Buffer.from("s3"));
      const buffer = await loadFileData({
        bucket: "my-bucket",
        file: "uploads/a.pdf",
      });
      expect(buffer.toString()).toBe("s3");
      expect(loadS3File).toHaveBeenCalledWith("my-bucket", "uploads/a.pdf");
    });

    it("loads from disk when data and bucket are absent", async () => {
      vi.mocked(loadLocalFile).mockResolvedValue(Buffer.from("disk"));
      const buffer = await loadFileData({ file: "uploads/a.pdf" });
      expect(buffer.toString()).toBe("disk");
      expect(loadLocalFile).toHaveBeenCalledWith("uploads/a.pdf");
    });
  });
});
