import { BadRequestError } from "@jaypie/errors";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

//
//
// Constants
//

const BULK_PACKAGE = "zeta";
const BULK_COUNT = 250;
const DEFAULT_LIMIT = 50;
const ENV_RELEASE_NOTES_PATH = "MCP_RELEASE_NOTES_PATH";
const MAXIMUM_LIMIT = 200;
const NEXT_PAGE_PATTERN =
  /Next page: release_notes\("list", \{ cursor: "([^"]+)" \}\)/;

// Written out of order on purpose; the list must sort them
const SMALL_NOTES: Record<string, string[]> = {
  alpha: ["1.2.0", "0.9.0", "1.10.0", "1.0.0"],
  beta: ["2.0.1", "2.0.0"],
  gamma: ["0.1.0"],
};

//
//
// Helpers
//

type ReleaseNotesService = (args: {
  command?: string;
  input?: Record<string, unknown>;
}) => Promise<string>;

function noteContent(version: string): string {
  return `---\nversion: ${version}\ndate: 2026-01-01\nsummary: Release ${version}\n---\n\n## Changes\n`;
}

async function writeNotes({
  directory,
  packageName,
  versions,
}: {
  directory: string;
  packageName: string;
  versions: string[];
}): Promise<void> {
  const packageDirectory = path.join(directory, packageName);
  await mkdir(packageDirectory, { recursive: true });
  await Promise.all(
    versions.map((version) =>
      writeFile(
        path.join(packageDirectory, `${version}.md`),
        noteContent(version),
      ),
    ),
  );
}

function listItems(output: string): string[] {
  return output.split("\n").filter((line) => line.startsWith("* "));
}

function itemKey(line: string): string {
  return line.slice(2).split(" ")[0];
}

function nextCursor(output: string): string | undefined {
  return output.match(NEXT_PAGE_PATTERN)?.[1];
}

//
//
// Run tests
//

describe("release_notes list pagination", () => {
  let directory: string;
  let originalPath: string | undefined;
  let releaseNotesService: ReleaseNotesService;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "jaypie-mcp-release-notes-"));
    for (const [packageName, versions] of Object.entries(SMALL_NOTES)) {
      await writeNotes({ directory, packageName, versions });
    }
    await writeNotes({
      directory,
      packageName: BULK_PACKAGE,
      versions: Array.from(
        { length: BULK_COUNT },
        (_, index) => `1.0.${index}`,
      ),
    });

    originalPath = process.env[ENV_RELEASE_NOTES_PATH];
    process.env[ENV_RELEASE_NOTES_PATH] = directory;
    vi.resetModules();
    const docs = await import("../suites/docs/index.js");
    releaseNotesService = docs.releaseNotesService as ReleaseNotesService;
  });

  afterAll(async () => {
    if (originalPath === undefined) {
      delete process.env[ENV_RELEASE_NOTES_PATH];
    } else {
      process.env[ENV_RELEASE_NOTES_PATH] = originalPath;
    }
    await rm(directory, { force: true, recursive: true });
  });

  describe("limit", () => {
    it("returns 50 notes by default", async () => {
      const output = await releaseNotesService({ command: "list" });
      expect(listItems(output)).toHaveLength(DEFAULT_LIMIT);
      expect(nextCursor(output)).toBeString();
    });

    it("honors an explicit limit", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: 3 },
      });
      expect(listItems(output)).toHaveLength(3);
    });

    it("accepts a numeric string limit", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: "4" },
      });
      expect(listItems(output)).toHaveLength(4);
    });

    it("clamps a limit above the maximum to 200", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: 1000 },
      });
      expect(listItems(output)).toHaveLength(MAXIMUM_LIMIT);
      expect(nextCursor(output)).toBeString();
    });

    it.each([0, -1, "many"])("rejects an invalid limit (%s)", async (limit) => {
      await expect(
        releaseNotesService({ command: "list", input: { limit } }),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("order", () => {
    it("sorts by package ascending then semver descending", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: 10 },
      });
      expect(listItems(output).map(itemKey)).toEqual([
        "alpha@1.10.0",
        "alpha@1.2.0",
        "alpha@1.0.0",
        "alpha@0.9.0",
        "beta@2.0.1",
        "beta@2.0.0",
        "gamma@0.1.0",
        "zeta@1.0.249",
        "zeta@1.0.248",
        "zeta@1.0.247",
      ]);
    });
  });

  describe("cursor", () => {
    it("walks every note once with no overlap or gaps", async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const output: string = await releaseNotesService({
          command: "list",
          input: cursor ? { cursor } : { limit: 7 },
        });
        seen.push(...listItems(output).map(itemKey));
        cursor = nextCursor(output);
        pages += 1;
      } while (cursor && pages < 100);

      const total =
        BULK_COUNT +
        Object.values(SMALL_NOTES).reduce(
          (sum, versions) => sum + versions.length,
          0,
        );
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
      expect(pages).toBe(Math.ceil(total / 7));
    });

    it("matches an unpaginated walk in the same order", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 4 },
      });
      const second = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(first) },
      });
      const combined = await releaseNotesService({
        command: "list",
        input: { limit: 8 },
      });
      expect([...listItems(first), ...listItems(second)]).toEqual(
        listItems(combined),
      );
    });

    it("lets an explicit limit override the limit carried by the cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 2 },
      });
      const second = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(first), limit: 5 },
      });
      expect(listItems(second).map(itemKey)).toEqual([
        "alpha@1.0.0",
        "alpha@0.9.0",
        "beta@2.0.1",
        "beta@2.0.0",
        "gamma@0.1.0",
      ]);
    });

    it.each(["not-a-cursor", "e30", "eyJvZmZzZXQiOi0xfQ", "!!!"])(
      "rejects an invalid cursor (%s)",
      async (cursor) => {
        await expect(
          releaseNotesService({ command: "list", input: { cursor } }),
        ).rejects.toThrow(BadRequestError);
      },
    );
  });

  describe("footer", () => {
    it("omits the footer on the last page", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { package: "alpha" },
      });
      expect(listItems(output)).toHaveLength(4);
      expect(output).not.toContain("Next page");
    });

    it("omits the footer when results exactly fill the page", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: 4, package: "alpha" },
      });
      expect(listItems(output)).toHaveLength(4);
      expect(output).not.toContain("Next page");
    });

    it("prints the footer exactly when more results exist", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { limit: 3, package: "alpha" },
      });
      const lines = output.trim().split("\n");
      expect(lines[lines.length - 1]).toMatch(NEXT_PAGE_PATTERN);
    });
  });

  describe("filters", () => {
    it("paginates within a package filter carried by the cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 3, package: "alpha" },
      });
      const second = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(first) },
      });
      expect(listItems(second).map(itemKey)).toEqual(["alpha@0.9.0"]);
      expect(second).not.toContain("Next page");
    });

    it("paginates within a since_version filter carried by the cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 2, since_version: "1.0.245" },
      });
      expect(listItems(first).map(itemKey)).toEqual([
        "alpha@1.10.0",
        "alpha@1.2.0",
      ]);
      const second = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(first) },
      });
      expect(listItems(second).map(itemKey)).toEqual([
        "beta@2.0.1",
        "beta@2.0.0",
      ]);
      const third = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(second) },
      });
      expect(listItems(third).map(itemKey)).toEqual([
        "zeta@1.0.249",
        "zeta@1.0.248",
      ]);
      const fourth = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(third) },
      });
      expect(listItems(fourth).map(itemKey)).toEqual([
        "zeta@1.0.247",
        "zeta@1.0.246",
      ]);
      expect(fourth).not.toContain("Next page");
    });

    it("rejects a package filter that conflicts with the cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 2, package: "alpha" },
      });
      await expect(
        releaseNotesService({
          command: "list",
          input: { cursor: nextCursor(first), package: "beta" },
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects a since_version filter that conflicts with the cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 2, since_version: "1.0.0" },
      });
      await expect(
        releaseNotesService({
          command: "list",
          input: { cursor: nextCursor(first), since_version: "2.0.0" },
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("accepts filters repeated alongside a matching cursor", async () => {
      const first = await releaseNotesService({
        command: "list",
        input: { limit: 2, package: "alpha" },
      });
      const second = await releaseNotesService({
        command: "list",
        input: { cursor: nextCursor(first), limit: 2, package: "alpha" },
      });
      expect(listItems(second).map(itemKey)).toEqual([
        "alpha@1.0.0",
        "alpha@0.9.0",
      ]);
    });

    it("keeps the unknown package message", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { package: "missing" },
      });
      expect(output).toBe('No release notes found for package "missing".');
    });

    it("keeps the empty since_version message", async () => {
      const output = await releaseNotesService({
        command: "list",
        input: { package: "gamma", since_version: "9.0.0" },
      });
      expect(output).toBe("No release notes found newer than 9.0.0.");
    });
  });

  describe("help", () => {
    it("documents limit and cursor", async () => {
      const output = await releaseNotesService({});
      expect(output).toContain("`limit`");
      expect(output).toContain("`cursor`");
    });
  });
});
