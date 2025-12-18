import typescript from "@rollup/plugin-typescript";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

// External dependencies - these are not bundled
const external = [
  "@jaypie/aws",
  "@jaypie/core",
  "@jaypie/datadog",
  "@jaypie/errors",
  "@jaypie/express",
  "@jaypie/kit",
  "@jaypie/lambda",
  "@jaypie/logger",
];

export default [
  // ES modules version
  {
    input: "src/index.ts",
    onwarn,
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
    external,
  },
  // CommonJS version
  {
    input: "src/index.ts",
    onwarn,
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
    external,
  },
];
