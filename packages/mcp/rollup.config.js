import { readFileSync } from "node:fs";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const version = pkg.version;
const commitHash = (process.env.PROJECT_COMMIT || "").slice(0, 8);
const versionString = `@jaypie/mcp@${version}${commitHash ? `#${commitHash}` : ""}`;

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

export default {
  input: [
    "src/index.ts",
    "src/suite.ts",
    "src/suites/aws/index.ts",
    "src/suites/datadog/index.ts",
    "src/suites/docs/index.ts",
    "src/suites/llm/index.ts",
  ],
  onwarn,
  output: {
    dir: "dist",
    format: "es",
    preserveModules: true,
    preserveModulesRoot: "src",
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
    copy({
      targets: [
        { src: "src/suites/aws/help.md", dest: "dist/suites/aws" },
        { src: "src/suites/datadog/help.md", dest: "dist/suites/datadog" },
        { src: "src/suites/llm/help.md", dest: "dist/suites/llm" },
        {
          src: "src/suites/docs/release-notes/help.md",
          dest: "dist/suites/docs/release-notes",
        },
      ],
    }),
  ],
  external: [
    "@jaypie/errors",
    "@jaypie/fabric",
    "@jaypie/fabric/mcp",
    "@jaypie/llm",
    "@modelcontextprotocol/sdk/server/mcp.js",
    "@modelcontextprotocol/sdk/server/stdio.js",
    "@modelcontextprotocol/sdk/server/streamableHttp.js",
    "commander",
    "gray-matter",
    "node:child_process",
    "node:crypto",
    "node:fs",
    "node:fs/promises",
    "node:https",
    "node:os",
    "node:path",
    "node:url",
    "semver",
    "zod",
  ],
};
