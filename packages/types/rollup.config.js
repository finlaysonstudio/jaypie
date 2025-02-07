import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/jaypie.d.ts",
  output: [
    {
      file: "dist/index.js",
      format: "es",
    },
  ],
  plugins: [typescript()],
  external: ["zod"],
};
