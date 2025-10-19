import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
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
    "node:fs/promises",
    "node:path",
    "node:url",
    "zod",
  ],
};
