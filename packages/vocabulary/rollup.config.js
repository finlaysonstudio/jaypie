import typescript from "@rollup/plugin-typescript";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript" && warning.message.includes("@jaypie/")) {
    return;
  }
  defaultHandler(warning);
};

const external = [
  "@jaypie/aws",
  "@jaypie/errors",
  "@jaypie/lambda",
  "@modelcontextprotocol/sdk/server/mcp.js",
  "commander",
];

export default [
  // ES modules version - main
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
    external,
  },
  // ES modules version - commander
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/commander/index.ts",
    output: {
      dir: "dist/esm/commander",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/commander",
      }),
    ],
    external,
  },
  // CommonJS version - main
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
    external,
  },
  // CommonJS version - commander
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/commander/index.ts",
    output: {
      dir: "dist/cjs/commander",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/cjs/commander",
      }),
    ],
    external,
  },
  // ES modules version - lambda
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/lambda/index.ts",
    output: {
      dir: "dist/esm/lambda",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/lambda",
      }),
    ],
    external,
  },
  // CommonJS version - lambda
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/lambda/index.ts",
    output: {
      dir: "dist/cjs/lambda",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/cjs/lambda",
      }),
    ],
    external,
  },
  // ES modules version - llm
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/llm/index.ts",
    output: {
      dir: "dist/esm/llm",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/llm",
      }),
    ],
    external,
  },
  // CommonJS version - llm
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/llm/index.ts",
    output: {
      dir: "dist/cjs/llm",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/cjs/llm",
      }),
    ],
    external,
  },
  // ES modules version - mcp
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/mcp/index.ts",
    output: {
      dir: "dist/esm/mcp",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/mcp",
      }),
    ],
    external,
  },
  // CommonJS version - mcp
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/mcp/index.ts",
    output: {
      dir: "dist/cjs/mcp",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/cjs/mcp",
      }),
    ],
    external,
  },
];
