import { describe, expect, it } from "vitest";

import {
  getFileExtension,
  getMimeType,
  isImageExtension,
  isPdfExtension,
} from "../detectMimeType.js";

describe("detectMimeType", () => {
  describe("getFileExtension", () => {
    it("extracts extension from simple filename", () => {
      expect(getFileExtension("document.pdf")).toBe("pdf");
    });

    it("extracts extension from path", () => {
      expect(getFileExtension("/path/to/document.pdf")).toBe("pdf");
    });

    it("extracts extension case-insensitively", () => {
      expect(getFileExtension("photo.PNG")).toBe("png");
    });

    it("returns undefined for file without extension", () => {
      expect(getFileExtension("README")).toBe(undefined);
    });

    it("handles dotfiles", () => {
      expect(getFileExtension(".gitignore")).toBe("gitignore");
    });

    it("handles multiple dots", () => {
      expect(getFileExtension("file.name.pdf")).toBe("pdf");
    });
  });

  describe("getMimeType", () => {
    it("returns correct MIME type for PDF", () => {
      expect(getMimeType("document.pdf")).toBe("application/pdf");
    });

    it("returns correct MIME type for PNG", () => {
      expect(getMimeType("photo.png")).toBe("image/png");
    });

    it("returns correct MIME type for JPG", () => {
      expect(getMimeType("photo.jpg")).toBe("image/jpeg");
    });

    it("returns correct MIME type for JPEG", () => {
      expect(getMimeType("photo.jpeg")).toBe("image/jpeg");
    });

    it("returns correct MIME type for GIF", () => {
      expect(getMimeType("animation.gif")).toBe("image/gif");
    });

    it("returns correct MIME type for WebP", () => {
      expect(getMimeType("photo.webp")).toBe("image/webp");
    });

    it("returns undefined for unknown extension", () => {
      expect(getMimeType("file.xyz")).toBe(undefined);
    });

    it("returns undefined for file without extension", () => {
      expect(getMimeType("README")).toBe(undefined);
    });
  });

  describe("isImageExtension", () => {
    it("returns true for PNG", () => {
      expect(isImageExtension("photo.png")).toBe(true);
    });

    it("returns true for JPG", () => {
      expect(isImageExtension("photo.jpg")).toBe(true);
    });

    it("returns true for JPEG", () => {
      expect(isImageExtension("photo.jpeg")).toBe(true);
    });

    it("returns true for GIF", () => {
      expect(isImageExtension("animation.gif")).toBe(true);
    });

    it("returns true for WebP", () => {
      expect(isImageExtension("photo.webp")).toBe(true);
    });

    it("returns true for AVIF", () => {
      expect(isImageExtension("photo.avif")).toBe(true);
    });

    it("returns false for PDF", () => {
      expect(isImageExtension("document.pdf")).toBe(false);
    });

    it("returns false for unknown extension", () => {
      expect(isImageExtension("file.xyz")).toBe(false);
    });

    it("returns false for file without extension", () => {
      expect(isImageExtension("README")).toBe(false);
    });
  });

  describe("isPdfExtension", () => {
    it("returns true for PDF", () => {
      expect(isPdfExtension("document.pdf")).toBe(true);
    });

    it("returns true for PDF in path", () => {
      expect(isPdfExtension("/path/to/document.pdf")).toBe(true);
    });

    it("returns false for PNG", () => {
      expect(isPdfExtension("photo.png")).toBe(false);
    });

    it("returns false for file without extension", () => {
      expect(isPdfExtension("README")).toBe(false);
    });
  });
});
