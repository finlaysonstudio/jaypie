import typescript from "@rollup/plugin-typescript";

// Filter out expected warnings:
// - TS2307: Cannot find module '@jaypie/*' (external workspace dependencies)
// - TS5055: Cannot write file because it would overwrite input file (declaration files from previous build)
const onwarn = (warning, defaultHandler) => {
  if (warning.plugin === "typescript") {
    if (warning.message.includes("@jaypie/")) {
      return;
    }
    if (warning.message.includes("TS5055")) {
      return;
    }
  }
  defaultHandler(warning);
};

const external = [
  "@jaypie/aws",
  "@jaypie/dynamodb",
  "@jaypie/errors",
  "@jaypie/lambda",
  "@modelcontextprotocol/sdk/server/mcp.js",
  "commander",
  "express",
  "zod",
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
  // ES modules version - http
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/http/index.ts",
    output: {
      dir: "dist/esm/http",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/http",
      }),
    ],
    external,
  },
  // CommonJS version - http
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/http/index.ts",
    output: {
      dir: "dist/cjs/http",
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
        outDir: "dist/cjs/http",
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
  // ES modules version - express
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/express/index.ts",
    output: {
      dir: "dist/esm/express",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/express",
      }),
    ],
    external,
  },
  // CommonJS version - express
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/express/index.ts",
    output: {
      dir: "dist/cjs/express",
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
        outDir: "dist/cjs/express",
      }),
    ],
    external,
  },
  // ES modules version - data
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/data/index.ts",
    output: {
      dir: "dist/esm/data",
      format: "es",
      sourcemap: true,
    },
    onwarn,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist/esm/data",
      }),
    ],
    external,
  },
  // CommonJS version - data
  // NOTE: declaration: false because main build generates correct .d.ts files
  {
    input: "src/data/index.ts",
    output: {
      dir: "dist/cjs/data",
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
        outDir: "dist/cjs/data",
      }),
    ],
    external,
  },
];
