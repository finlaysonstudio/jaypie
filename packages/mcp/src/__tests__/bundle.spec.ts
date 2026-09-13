import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { skillService } from "../suites/docs/index.js";

//
//
// Constants
//

const execFileAsync = promisify(execFile);

const PACKAGE_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ASSET_DIRECTORIES = ["release-notes", "skills"];
const BUNDLE_FILE = "mcp.mjs";
const BUNDLE_TIMEOUT = 60000;
const DOCS_SUITE_SOURCE = path.join(PACKAGE_ROOT, "src/suites/docs/index.ts");
const MCP_PATH_VARIABLES = [
  "MCP_BUILTIN_SKILLS_PATH",
  "MCP_RELEASE_NOTES_PATH",
  "MCP_SKILLS_PATH",
];

// Mirrors the esbuild recipe in skills/express.md
const BANNER = `import { createRequire as __bannerCreateRequire } from "node:module";
const require = __bannerCreateRequire(import.meta.url);`;

const ENTRY = `import { releaseNotesService, skillService } from ${JSON.stringify(DOCS_SUITE_SOURCE)};
const attempt = (call) => call().catch((error) => \`ERROR \${error.message}\`);
const help = await attempt(() => releaseNotesService({}));
const index = await attempt(() => skillService({ alias: "index" }));
const notes = await attempt(() => releaseNotesService({ command: "list", input: { package: "mcp" } }));
console.log(JSON.stringify({ help, index, notes }));`;

//
//
// Helpers
//

interface BundleOutput {
  help: string;
  index: string;
  notes: string;
  stderr: string;
}

async function runBundle(directory: string): Promise<BundleOutput> {
  const env = { ...process.env };
  // CI preloads dd-trace through NODE_OPTIONS, which cannot resolve beside the bundle
  delete env.NODE_OPTIONS;
  for (const variable of MCP_PATH_VARIABLES) {
    delete env[variable];
  }
  const { stderr, stdout } = await execFileAsync(
    process.execPath,
    [path.join(directory, BUNDLE_FILE)],
    { cwd: directory, env },
  );
  return { ...JSON.parse(stdout), stderr };
}

//
//
// Run tests
//

describe("docs suite bundled with esbuild", () => {
  let bareDirectory: string;
  let root: string;
  let withAssetsDirectory: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "jaypie-mcp-bundle-"));
    bareDirectory = path.join(root, "bare");
    withAssetsDirectory = path.join(root, "with-assets");

    await build({
      banner: { js: BANNER },
      bundle: true,
      format: "esm",
      logLevel: "silent",
      outfile: path.join(bareDirectory, BUNDLE_FILE),
      platform: "node",
      stdin: { contents: ENTRY, loader: "ts", resolveDir: PACKAGE_ROOT },
    });

    await mkdir(withAssetsDirectory, { recursive: true });
    await cp(
      path.join(bareDirectory, BUNDLE_FILE),
      path.join(withAssetsDirectory, BUNDLE_FILE),
    );
    for (const directory of ASSET_DIRECTORIES) {
      await cp(
        path.join(PACKAGE_ROOT, directory),
        path.join(withAssetsDirectory, directory),
        { recursive: true },
      );
    }
  }, BUNDLE_TIMEOUT);

  afterAll(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("serves release notes help without shipped files", async () => {
    const output = await runBundle(bareDirectory);
    expect(output.help).toMatch(/^# Release Notes/);
  });

  it("warns when the skill and release note directories are missing", async () => {
    const output = await runBundle(bareDirectory);
    expect(output.stderr).toContain("MCP_BUILTIN_SKILLS_PATH");
    expect(output.stderr).toContain("MCP_RELEASE_NOTES_PATH");
  });

  it("serves the skill index from assets beside the bundle", async () => {
    const unbundled = await skillService({ alias: "index" });
    const output = await runBundle(withAssetsDirectory);
    expect(output.index).toBe(unbundled);
    expect(output.stderr).toBe("");
  });

  it("lists release notes from assets beside the bundle", async () => {
    const output = await runBundle(withAssetsDirectory);
    expect(output.notes).toContain("* mcp@");
  });
});
