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
    external: ["@jaypie/errors", "@jaypie/logger", "node:crypto", "uuid"],
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
    external: ["@jaypie/errors", "@jaypie/logger", "node:crypto", "uuid"],
  },
  // Type definitions (ESM): bundled to a single self-contained declaration file.
  {
    input: "src/index.ts",
    output: { file: "dist/esm/index.d.ts", format: "es" },
    plugins: [dts()],
    external: dtsExternal,
  },
  // Type definitions (CommonJS): emitted as .d.cts so node16/nodenext flags it
  // as a CommonJS declaration under the package's "type": "module" setting.
  {
    input: "src/index.ts",
    output: { file: "dist/cjs/index.d.cts", format: "es" },
    plugins: [dts()],
    external: dtsExternal,
  },
];
