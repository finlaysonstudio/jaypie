import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [typescript()],
  external: [
    "@aws-sdk/client-textract",
    "@jaypie/core",
    "amazon-textract-response-parser",
  ],
};
