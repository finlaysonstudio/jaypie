import js from "@eslint/js";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import vitest from "@vitest/eslint-plugin";

export default [
  //
  //
  // Configs and Plugins
  //
  js.configs.recommended, // Recommended config applied to all files
  pluginPrettierRecommended, // Prettier wants to always be the last plugin

  //
  //
  // Project Overrides
  //
  {
    // Global Ignore
    ignores: ["**/dist/**", "dist/"],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },

  //
  //
  // Vitest
  //
  {
    files: ["**/__tests__/**", "**/*.spec.js", "**/*.test.js"],
    plugins: {
      vitest,
    },
    rules: {
      "vitest/no-focused-tests": ["error", { fixable: false }],
      "vitest/no-disabled-tests": "warn",
    },
  },
];
