import vitest from "eslint-plugin-vitest";
import tsPlugin from "@typescript-eslint/eslint-plugin";
// eslint-disable-next-line import-x/default
import tsParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  {
    ignores: ["dist/**"],
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "prettier/prettier": "warn",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        vi: true,
      },
    },
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
];
