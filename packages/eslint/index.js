import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintPluginImportX from 'eslint-plugin-import-x'
import prettierPlugin from "eslint-plugin-prettier";

export default [
  //
  //
  // Configs and Plugins
  //
  js.configs.recommended, // Recommended config applied to all files
  eslintPluginImportX.flatConfigs.recommended,
  eslintPluginImportX.flatConfigs.typescript,

  //
  //
  // Jaypie General
  //
  {
    // Always ignore dist (build) folders
    ignores: ["**/dist/**", "dist/"],
  },
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,
      sourceType: "module",
    },
  },
  {
    rules: {
      "no-console": "warn",
      "no-fallthrough": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='require']",
          message: "Unexpected require, use import instead.",
        },
        {
          selector:
            "MemberExpression[object.name='module'][property.name='exports']",
          message: "Unexpected module.exports, use export instead.",
        },
        {
          selector: "MemberExpression[object.name='exports']",
          message: "Unexpected exports, use export instead.",
        },
      ],
      "no-shadow": "warn",
      "no-shadow-restricted-names": "error",
      "no-unused-vars": "warn",
      "object-shorthand": ["error", "always"],
    },
  },

  //
  //
  // CommonJS
  //
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration",
          message: "Unexpected import, use require instead.",
        },
        {
          selector: "ExportNamedDeclaration",
          message: "Unexpected export, use module.exports instead.",
        },
        {
          selector: "ExportDefaultDeclaration",
          message: "Unexpected export, use module.exports instead.",
        },
      ],
    },
  },

  //
  //
  // Nuxt
  //
  {
    // Ignore auto-generated Nuxt folders
    ignores: ["**/.nuxt/**", ".nuxt/"],
  },

  //
  //
  // Prettier
  //
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "warn",
    },
  },

  //
  //
  // TypeScript
  //
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "prettier": prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "prettier/prettier": "warn",
    },
  },

  //
  //
  // Tests (JavaScript and TypeScript)
  //
  {
    files: ["**/__tests__/**", "**/*.spec.js", "**/*.test.js", "**/*.spec.ts", "**/*.test.ts"],
    plugins: {
      vitest,
    },
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
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": ["error", { fixable: false }],
      "vitest/no-disabled-tests": "warn",
    },
  },
];
