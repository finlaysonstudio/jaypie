import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

// Bundle declarations: keep every bare specifier external so dts() inlines only
// our own relative files, producing a single self-contained declaration that
// resolves under node16/nodenext module resolution.
const dtsExternal = (id) => !/^[./]/.test(id);

export default [
  {
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
  },
  // Type definitions: bundled to a single self-contained declaration file.
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "es" },
    plugins: [dts()],
    external: dtsExternal,
  },
];
