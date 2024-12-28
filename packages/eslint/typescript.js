import globals from "globals";
import pluginJs from "@eslint/js";
import tsEslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    plugins: {
      "@stylistic": stylistic,
      "prettier": pluginPrettier,
    },
    rules: {
      // Keep only the rules that don't conflict with Prettier
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      // Enable Prettier as an ESLint rule
      "prettier/prettier": "error",
    },
  },
  prettier, // This should be last to override other style rules
];
