import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["**/*.spec.ts"],
    }),
  ],
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "Fabricator",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@faker-js/faker",
        "path",
        "os",
        "crypto",
        "fs",
        "child_process",
        "events",
        "process",
        "buffer",
        "stream",
        "util",
        "node:path",
        "node:os",
        "node:crypto",
        "node:fs",
        "node:child_process",
        "node:events",
        "node:process",
        "node:buffer",
        "node:stream",
        "node:util",
      ],
    },
    target: "node18",
  },
});
