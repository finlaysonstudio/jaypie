import autoExternal from "rollup-plugin-auto-external";
import typescript from "@rollup/plugin-typescript";

// Externals not caught by auto-external (peer deps + node: prefixed builtins)
const external = ["express", /^node:/];

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
    external,
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    onwarn,
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
    external,
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
      autoExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
      }),
    ],
  },
];
