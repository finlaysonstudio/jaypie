/// <reference types="vitest" />

import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.js"],
  },
});
