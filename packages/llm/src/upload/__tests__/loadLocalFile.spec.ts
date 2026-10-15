import { describe, expect, it } from "vitest";

import { BadRequestError } from "@jaypie/errors";

import { loadLocalFile } from "../loadLocalFile.js";

//
//
// Tests
//

describe("loadLocalFile", () => {
  describe("Base Cases", () => {
    it("reads a file relative to the working directory", async () => {
      const buffer = await loadLocalFile("package.json");
      expect(buffer.toString()).toContain('"name"');
    });
  });

  describe("Error Conditions", () => {
    it("throws BadRequestError when the file does not exist", async () => {
      await expect(loadLocalFile("uploads/does-not-exist.pdf")).rejects.toThrow(
        BadRequestError,
      );
    });
  });
});
