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
      }),
    ],
    external: [
      "@jaypie/aws",
      "@jaypie/core",
      "@jaypie/datadog",
      "@jaypie/errors",
      "@jaypie/express",
      "@jaypie/kit",
      "@jaypie/lambda",
      "@jaypie/llm",
      "@jaypie/logger",
      "@jaypie/mongoose",
      "module",
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
      }),
    ],
    external: [
      "@jaypie/aws",
      "@jaypie/core",
      "@jaypie/datadog",
      "@jaypie/errors",
      "@jaypie/express",
      "@jaypie/kit",
      "@jaypie/lambda",
      "@jaypie/llm",
      "@jaypie/logger",
      "@jaypie/mongoose",
      "module",
    ],
  },
];
