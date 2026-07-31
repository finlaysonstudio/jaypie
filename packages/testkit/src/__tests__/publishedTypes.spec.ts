import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const PACKAGE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FIXTURE_DIR = resolve(PACKAGE_DIR, "test", "consumer");
const PUBLISHED_TYPES = resolve(PACKAGE_DIR, "dist", "index.d.ts");
const TIMEOUT = 60000;
const TSC = resolve(PACKAGE_DIR, "..", "..", "node_modules", ".bin", "tsc");

interface TypecheckResult {
  code: number;
  stdout: string;
}

async function typecheck(project: string): Promise<TypecheckResult> {
  try {
    const { stdout } = await execFileAsync(
      TSC,
      ["--noEmit", "--project", project],
      { cwd: FIXTURE_DIR },
    );
    return { code: 0, stdout };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? "" };
  }
}

describe("Published types", () => {
  beforeAll(() => {
    if (!existsSync(PUBLISHED_TYPES)) {
      throw new Error(
        `${PUBLISHED_TYPES} is missing. Run "npm run build -w packages/testkit" first.`,
      );
    }
  });

  describe("Base Cases", () => {
    it("Ships a dist entry point", () => {
      expect(existsSync(PUBLISHED_TYPES)).toBe(true);
    });
  });

  describe("Observability", () => {
    it(
      "Rejects a matcher that does not exist",
      async () => {
        const { code, stdout } = await typecheck("tsconfig.negative.json");
        expect(code).not.toBe(0);
        expect(stdout).toContain("toBeNotARealJaypieMatcher");
      },
      TIMEOUT,
    );
  });

  describe("Happy Paths", () => {
    it(
      "Typechecks matchers from the published package alone",
      async () => {
        const { code, stdout } = await typecheck("tsconfig.json");
        expect(stdout).toBe("");
        expect(code).toBe(0);
      },
      TIMEOUT,
    );
  });
});
