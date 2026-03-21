import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/__tests__/**",
        "**/*.spec.ts",
        "**/index.ts",
        "dist/**",
        "vitest.*.ts",
      ],
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["**/*.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
