import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isLlmOcrResolvedDocument,
  resolveOcrDocument,
  toDataUri,
} from "../resolveOcrDocument.js";

const loadLocalFile = vi.fn();
const loadS3File = vi.fn();
const extractPdfPages = vi.fn();

vi.mock("../../upload/loadLocalFile.js", () => ({
  loadLocalFile: (...args: unknown[]) => loadLocalFile(...args),
}));
vi.mock("../../upload/loadS3File.js", () => ({
  loadS3File: (...args: unknown[]) => loadS3File(...args),
}));
vi.mock("../../upload/extractPdfPages.js", () => ({
  extractPdfPages: (...args: unknown[]) => extractPdfPages(...args),
  getPdfPageCount: vi.fn(),
}));

describe("resolveOcrDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLocalFile.mockResolvedValue(Buffer.from("local"));
    loadS3File.mockResolvedValue(Buffer.from("s3"));
    extractPdfPages.mockResolvedValue(Buffer.from("trimmed"));
  });

  afterEach(() => {
    delete process.env.CDK_ENV_BUCKET;
  });

  it("Works", () => {
    expect(resolveOcrDocument).toBeFunction();
  });

  describe("Error Conditions", () => {
    it("Rejects an empty string", async () => {
      await expect(resolveOcrDocument("  ")).rejects.toThrow(/empty/);
    });

    it("Rejects a malformed data URI", async () => {
      await expect(resolveOcrDocument("data:nope")).rejects.toThrow(
        /malformed/,
      );
    });

    it("Rejects an unknown object", async () => {
      await expect(resolveOcrDocument({} as unknown as string)).rejects.toThrow(
        /string, file, or image/,
      );
    });
  });

  describe("Happy Paths", () => {
    it("Passes an https URL through untouched", async () => {
      const resolved = await resolveOcrDocument(
        "https://x.test/scans/invoice.pdf?sig=1",
      );
      expect(resolved).toEqual({
        filename: "invoice.pdf",
        mimeType: "application/pdf",
        source: { kind: "url", url: "https://x.test/scans/invoice.pdf?sig=1" },
      });
      expect(toDataUri(resolved)).toBe(
        "https://x.test/scans/invoice.pdf?sig=1",
      );
    });

    it("Decodes a data URI into a buffer", async () => {
      const base64 = Buffer.from("%PDF").toString("base64");
      const resolved = await resolveOcrDocument(
        `data:application/pdf;base64,${base64}`,
      );
      expect(resolved.filename).toBe("document.pdf");
      expect(resolved.mimeType).toBe("application/pdf");
      expect(resolved.source.kind).toBe("data");
      expect(toDataUri(resolved)).toBe(`data:application/pdf;base64,${base64}`);
    });

    it("Loads a bare path from disk", async () => {
      const resolved = await resolveOcrDocument("./scans/page.png");
      expect(loadLocalFile).toHaveBeenCalledWith("./scans/page.png");
      expect(resolved.filename).toBe("page.png");
      expect(resolved.mimeType).toBe("image/png");
    });

    it("Loads a bare path from S3 when CDK_ENV_BUCKET is set", async () => {
      process.env.CDK_ENV_BUCKET = "env-bucket";
      await resolveOcrDocument("uploads/page.pdf");
      expect(loadS3File).toHaveBeenCalledWith("env-bucket", "uploads/page.pdf");
      expect(loadLocalFile).not.toHaveBeenCalled();
    });

    it("Honors an explicit bucket on the file form", async () => {
      await resolveOcrDocument({ bucket: "b", file: "k/page.pdf" });
      expect(loadS3File).toHaveBeenCalledWith("b", "k/page.pdf");
    });

    it("Uses inline data on the file form without loading", async () => {
      const resolved = await resolveOcrDocument({
        data: Buffer.from("hi").toString("base64"),
        file: "page.pdf",
      });
      expect(loadLocalFile).not.toHaveBeenCalled();
      expect(loadS3File).not.toHaveBeenCalled();
      expect(
        resolved.source.kind === "data" && resolved.source.buffer.toString(),
      ).toBe("hi");
    });

    it("Trims PDF pages locally when the file form names them", async () => {
      const resolved = await resolveOcrDocument({
        file: "page.pdf",
        pages: [2],
      });
      expect(extractPdfPages).toHaveBeenCalledWith(expect.any(Buffer), [2]);
      expect(
        resolved.source.kind === "data" && resolved.source.buffer.toString(),
      ).toBe("trimmed");
    });

    it("Accepts the image form", async () => {
      const resolved = await resolveOcrDocument({ image: "photo.jpg" });
      expect(resolved.mimeType).toBe("image/jpeg");
    });

    it("Returns an already-resolved document as is", async () => {
      const resolved = await resolveOcrDocument("https://x.test/a.pdf");
      expect(isLlmOcrResolvedDocument(resolved)).toBe(true);
      await expect(resolveOcrDocument(resolved)).resolves.toBe(
        resolved as never,
      );
    });
  });
});
