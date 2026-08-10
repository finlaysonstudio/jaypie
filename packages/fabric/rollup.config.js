import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

// Subpath entry points ("" is the package root). Every entry ships an ESM and
// a CommonJS bundle plus a bundled declaration per format, and every one of
// them is derived from this list — an entry added here reaches `dist` in all
// four shapes, which hand-written per-entry configs did not guarantee.
const entries = [
  "",
  "commander",
  "data",
  "express",
  "http",
  "lambda",
  "llm",
  "mcp",
  "websocket",
];

// Bundle declarations: keep every bare specifier external so dts() inlines only
// our own relative files, producing a single self-contained declaration per
// entry point that resolves under node16/nodenext module resolution.
const dtsExternal = (id) => !/^[./]/.test(id);

const external = [
  "@jaypie/aws",
  "@jaypie/dynamodb",
  "@jaypie/errors",
  "@jaypie/express",
  "@jaypie/lambda",
  "@modelcontextprotocol/sdk/server/mcp.js",
  "commander",
  "express",
  "zod",
];

// Filter out expected warnings:
// - TS2307: Cannot find module '@jaypie/*' (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

const entryPath = (sub) => (sub ? `${sub}/index` : "index");
const sourcePath = (sub) => `src/${sub ? `${sub}/` : ""}index.ts`;

const input = Object.fromEntries(
  entries.map((sub) => [entryPath(sub), sourcePath(sub)]),
);

// One multi-entry build per format. A single pass shares one TypeScript
// program across every subpath, so code reachable from two entries is emitted
// once as a shared chunk instead of being duplicated into each subpath
// directory. Building each entry as its own config instead stood up a
// TypeScript program per config and retained every one of them for the life of
// the process, which exhausted the default V8 heap. The two formats stay
// separate configs because @rollup/plugin-typescript requires the compiler's
// `outDir` to sit inside the output `dir`.
const jsConfigs = [
  {
    input,
    output: {
      chunkFileNames: "chunks/[name]-[hash].js",
      dir: "dist/esm",
      entryFileNames: "[name].js",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        declaration: false,
        outDir: "dist/esm",
        tsconfig: "./tsconfig.json",
      }),
    ],
    external,
  },
  {
    input,
    output: {
      chunkFileNames: "chunks/[name]-[hash].cjs",
      dir: "dist/cjs",
      entryFileNames: "[name].cjs",
      exports: "named",
      format: "cjs",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        declaration: false,
        outDir: "dist/cjs",
        tsconfig: "./tsconfig.json",
      }),
    ],
    external,
  },
];

// Type definitions: one self-contained bundle per entry point, written to both
// format directories. dts() inlines every relative import, so the ESM and
// CommonJS declarations are byte-identical and one build serves both.
// rollup-plugin-dts owns declarations outright, so the JS build emits none.
const dtsConfigs = entries.map((sub) => ({
  input: sourcePath(sub),
  output: [
    { file: `dist/esm/${entryPath(sub)}.d.ts`, format: "es" },
    { file: `dist/cjs/${entryPath(sub)}.d.cts`, format: "es" },
  ],
  plugins: [dts()],
  external: dtsExternal,
}));

export default [...jsConfigs, ...dtsConfigs];
