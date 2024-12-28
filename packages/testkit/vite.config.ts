/// <reference types="vitest" />

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.{js,ts}"],
    setupFiles: ["./testSetup.ts"],
  },
});
