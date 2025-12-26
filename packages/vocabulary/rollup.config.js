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
      }),
    ],
    external: ["@jaypie/errors"],
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
      }),
    ],
    external: ["@jaypie/errors"],
  },
];
