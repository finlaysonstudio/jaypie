import autoExternal from "rollup-plugin-auto-external";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default [
  {
    input: "src/index.js", // Path to your main JavaScript file
    output: [
      {
        file: "dist/jaypie.esm.js", // Output file for ES Module
        format: "es", // ES Module format
      },
    ],
    plugins: [
      autoExternal(), // Automatically exclude dependencies from the bundle
      resolve(), // Tells Rollup how to find node modules
      commonjs(), // Converts CommonJS modules to ES6
    ],
  },
  {
    input: "src/index.js", // Path to the CommonJS file
    output: [
      {
        file: "dist/jaypie.cjs.js", // Output file for CommonJS
        format: "cjs", // CommonJS format
      },
    ],
    plugins: [
      autoExternal(), // Automatically exclude dependencies from the bundle
      resolve(), // Tells Rollup how to find node modules
      commonjs(), // Converts CommonJS modules to ES6
    ],
  },
];
