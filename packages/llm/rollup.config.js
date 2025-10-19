import typescript from "@rollup/plugin-typescript";

export default [
  // ES modules version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
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
      "@jaypie/aws",
      "@jaypie/core",
      "@jaypie/errors",
      "openai",
      "openai/helpers/zod",
      "openmeteo",
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
      "@jaypie/aws",
      "@jaypie/core",
      "@jaypie/errors",
      "openai",
      "openai/helpers/zod",
      "openmeteo",
      "random",
      "z-schema",
      "zod",
      "zod/v4",
    ],
  },
];
