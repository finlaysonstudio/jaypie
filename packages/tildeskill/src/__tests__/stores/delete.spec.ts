import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { BadRequestError, ConfigurationError } from "@jaypie/errors";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLayeredStore } from "../../stores/layered";
import { createMarkdownStore } from "../../stores/markdown";
import { createMemoryStore } from "../../stores/memory";

describe("SkillStore delete", () => {
  describe("createMemoryStore", () => {
    it("removes a record and returns true", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);
      await expect(store.delete("aws")).resolves.toBe(true);
      await expect(store.get("aws")).resolves.toBeNull();
      await expect(store.list()).resolves.toEqual([]);
    });

    it("returns false when the alias does not exist", async () => {
      const store = createMemoryStore();
      await expect(store.delete("missing")).resolves.toBe(false);
    });

    it("normalizes the alias", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);
      await expect(store.delete("AWS")).resolves.toBe(true);
      await expect(store.get("aws")).resolves.toBeNull();
    });

    it("does not apply plural/singular fallback", async () => {
      const store = createMemoryStore([{ alias: "skill", content: "# S" }]);
      await expect(store.delete("skills")).resolves.toBe(false);
      await expect(store.get("skill")).resolves.not.toBeNull();
    });
  });

  describe("createMarkdownStore", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tildeskill-delete-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { force: true, recursive: true });
    });

    it("removes the markdown file and returns true", async () => {
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");
      const store = createMarkdownStore({ path: tempDir });

      await expect(store.delete("aws")).resolves.toBe(true);
      await expect(fs.readdir(tempDir)).resolves.toEqual([]);
      await expect(store.get("aws")).resolves.toBeNull();
    });

    it("returns false when the file does not exist", async () => {
      const store = createMarkdownStore({ path: tempDir });
      await expect(store.delete("missing")).resolves.toBe(false);
    });

    it("rejects path traversal with BadRequestError", async () => {
      const outside = path.join(path.dirname(tempDir), "outside.md");
      const store = createMarkdownStore({ path: tempDir });

      await expect(store.delete("../outside")).rejects.toBeInstanceOf(
        BadRequestError,
      );
      await expect(fs.stat(outside)).rejects.toThrow();
    });
  });

  describe("createLayeredStore", () => {
    it("delegates a qualified alias to its layer", async () => {
      const local = createMemoryStore([{ alias: "aws", content: "# Local" }]);
      const jaypie = createMemoryStore([{ alias: "aws", content: "# Jaypie" }]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      await expect(store.delete("jaypie:aws")).resolves.toBe(true);
      await expect(jaypie.get("aws")).resolves.toBeNull();
      await expect(local.get("aws")).resolves.not.toBeNull();
    });

    it("returns false when the layer does not hold the alias", async () => {
      const store = createLayeredStore({
        layers: [{ namespace: "local", store: createMemoryStore() }],
      });
      await expect(store.delete("local:missing")).resolves.toBe(false);
    });

    it("throws ConfigurationError for an unqualified alias", async () => {
      const store = createLayeredStore({
        layers: [
          {
            namespace: "local",
            store: createMemoryStore([{ alias: "aws", content: "# AWS" }]),
          },
        ],
      });
      await expect(store.delete("aws")).rejects.toBeInstanceOf(
        ConfigurationError,
      );
    });
  });
});
