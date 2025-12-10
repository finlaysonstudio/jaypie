import { readFileSync } from "node:fs";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const version = pkg.version;
const commitHash = (process.env.PROJECT_COMMIT || "").slice(0, 8);
const versionString = `@jaypie/mcp@${version}${commitHash ? `#${commitHash}` : ""}`;

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_VERSION__: JSON.stringify(version),
        __BUILD_COMMIT__: JSON.stringify(commitHash),
        __BUILD_VERSION_STRING__: JSON.stringify(versionString),
      },
    }),
    typescript({
      exclude: ["**/__tests__/**/*", "**/*.test.ts"],
    }),
  ],
  external: [
    "@jaypie/core",
    "@jaypie/errors",
    "@modelcontextprotocol/sdk/server/mcp.js",
    "@modelcontextprotocol/sdk/server/stdio.js",
    "@modelcontextprotocol/sdk/server/streamableHttp.js",
    "commander",
    "gray-matter",
    "node:crypto",
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:url",
    "zod",
  ],
};
