/// <reference types="vitest" />

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    exclude: ["**/prompts/templates/**", "**/node_modules/**", "**/dist/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
