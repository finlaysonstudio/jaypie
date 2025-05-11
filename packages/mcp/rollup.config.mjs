import autoExternal from "rollup-plugin-auto-external";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

export default [
  // Main bundle
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/jaypie-mcp.cjs",
        format: "cjs",
      },
      {
        file: "dist/jaypie-mcp.esm.js",
        format: "esm",
      },
    ],
    plugins: [
      autoExternal(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        exclude: ["**/__tests__/**"],
      }),
    ],
  },
  // Type definitions
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
];