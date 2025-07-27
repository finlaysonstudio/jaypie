import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    typescript({
      exclude: ["**/__tests__/**/*", "**/*.test.ts"],
    }),
  ],
  external: ["@jaypie/core", "@jaypie/errors"],
};
