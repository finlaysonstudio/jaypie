import typescript from "@rollup/plugin-typescript";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

export default [
  // ES modules version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/esm",
        exclude: ["**/__tests__/**/*", "**/*.test.ts"],
      }),
    ],
    external: [
      "@anthropic-ai/sdk",
      "@google/genai",
      "@jaypie/aws",
      "@jaypie/errors",
      "@jaypie/kit",
      "@jaypie/logger",
      "@openrouter/sdk",
      "fs/promises",
      "openai",
      "openai/helpers/zod",
      "openmeteo",
      "path",
      "pdf-lib",
      "random",
      "z-schema",
      "zod",
      "zod/v4",
    ],
  },
  // CommonJS version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
        exclude: ["**/__tests__/**/*", "**/*.test.ts"],
      }),
    ],
    external: [
      "@anthropic-ai/sdk",
      "@google/genai",
      "@jaypie/aws",
      "@jaypie/errors",
      "@jaypie/kit",
      "@jaypie/logger",
      "@openrouter/sdk",
      "fs/promises",
      "openai",
      "openai/helpers/zod",
      "openmeteo",
      "path",
      "pdf-lib",
      "random",
      "z-schema",
      "zod",
      "zod/v4",
    ],
  },
];
