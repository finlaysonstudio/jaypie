import typescript from "@rollup/plugin-typescript";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (
    warning.plugin === "typescript" &&
    warning.message.includes("@jaypie/")
  ) {
    return;
  }
  defaultHandler(warning);
};

export default {
  input: "src/index.ts",
  onwarn,
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [typescript()],
  external: [
    "@aws-sdk/client-textract",
    "@jaypie/logger",
    "amazon-textract-response-parser",
  ],
};
