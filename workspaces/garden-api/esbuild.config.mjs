import { build } from "esbuild";
import { cpSync } from "node:fs";
import { builtinModules } from "module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Copy @jaypie/mcp assets (skills and release-notes) alongside bundle
const mcpPath = join(__dirname, "..", "..", "packages", "mcp");
cpSync(join(mcpPath, "skills"), join(__dirname, "dist", "skills"), {
  recursive: true,
});
cpSync(
  join(mcpPath, "release-notes"),
  join(__dirname, "dist", "release-notes"),
  {
    recursive: true,
  },
);

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  external: [
    "@aws-sdk/*",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  banner: {
    js: `import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join as __join } from "path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
process.env.MCP_SKILLS_PATH = process.env.MCP_SKILLS_PATH || __join(__dirname, "skills");
process.env.MCP_RELEASE_NOTES_PATH = process.env.MCP_RELEASE_NOTES_PATH || __join(__dirname, "release-notes");`,
  },
});
