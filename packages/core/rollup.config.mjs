import typescript from "@rollup/plugin-typescript";
import autoExternal from "rollup-plugin-auto-external";

const external = [
  "@jaypie/errors",
  "@jaypie/kit",
  "@jaypie/logger",
];

export default [
  // ES modules version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    external,
    plugins: [
      autoExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/esm",
      }),
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
    external,
    plugins: [
      autoExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
      }),
    ],
  },
];
