import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";
import { dts } from "rollup-plugin-dts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const external = [
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
  "@jaypie/textract",
  "amazon-textract-response-parser",
  "express",
  "fs/promises",
  "jest-extended",
  "jest-json-schema",
  "module",
  "mongoose",
  "node:util",
  "path",
  "url",
  "vitest",
];

export default [
  // Main package bundle
  {
    external,
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        exclude: ["**/__tests__/**/*", "**/*.test.ts", "**/*.spec.ts"],
        tsconfig: "./tsconfig.json",
        outDir: "./dist", // Ensure this matches the output directory
      }),
      copy({
        targets: [{ src: "src/mockTextract.json", dest: "dist" }],
      }),
    ],
  },

  // Mock subpackage bundle
  {
    external,
    input: "src/mock/index.ts",
    output: {
      dir: "dist/mock",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        exclude: ["**/__tests__/**/*", "**/*.test.ts", "**/*.spec.ts"],
        tsconfig: "./tsconfig.json",
        outDir: "./dist/mock", // Ensure this matches the output directory
      }),
    ],
  },

  // Type definitions for main package
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },

  // Type definitions for mock subpackage
  {
    input: "src/mock/index.ts",
    output: {
      file: "dist/mock/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
];
