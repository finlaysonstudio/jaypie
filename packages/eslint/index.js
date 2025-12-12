import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import * as tsParser from "@typescript-eslint/parser";
import { flatConfigs as importxFlatConfigs } from "eslint-plugin-import-x";
import prettierPlugin from "eslint-plugin-prettier";
import pluginPrettierVue from "eslint-plugin-prettier-vue";

export default [
  //
  //
  // Configs and Plugins
  //
  {
    ...js.configs.recommended,
    name: "jaypie:jsRecommended",
  },
  {
    ...importxFlatConfigs.recommended,
    name: "jaypie:importxRecommended",
  },
  {
    ...importxFlatConfigs.typescript,
    name: "jaypie:typescriptRecommended",
  },

  //
  //
  // Jaypie General
  //
  {
    name: "jaypie:ignore-build",
    // Always ignore build output folders
    ignores: ["**/cdk.out/**", "cdk.out/", "**/dist/**", "dist/"],
  },
  {
    name: "jaypie:language-options",
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,
      sourceType: "module",
    },
  },
  {
    name: "jaypie:rules",
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
      "no-shadow-restricted-names": "error",
      "no-shadow": "off",
      "no-unused-vars": "warn",
      "object-shorthand": ["error", "always"],
    },
  },

  //
  //
  // CommonJS
  //
  {
    name: "jaypie:commonjs",
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        afterEach: true,
        beforeEach: true,
        describe: true,
        expect: true,
        it: true,
        jest: true,
      },
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
    name: "jaypie:ignore-nuxt",
    ignores: [
      // Ignore nuxt packages
      "packages/nuxt",
      "packages/nuxt-*",
      "packages/*-nuxt",
      "packages/*-nuxt-*",
      // Ignore auto-generated Nuxt folders
      ".nuxt/",
    ],
  },

  //
  //
  // Prettier
  //
  {
    name: "jaypie:prettier",
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
    name: "jaypie:typescript",
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
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  //
  //
  // Tests (JavaScript and TypeScript)
  //
  {
    name: "jaypie:tests",
    files: [
      "**/__tests__/**",
      "**/*.spec.js",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.test.ts",
    ],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "vitest/expect-expect": "warn",
      "vitest/no-conditional-expect": "off",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": ["error", { fixable: false }],
    },
  },

  //
  //
  // Vue
  //
  {
    name: "jaypie:vue",
    files: ["**/*.vue"],
    plugins: {
      "prettier-vue": pluginPrettierVue,
    },
    rules: {
      "import-x/extensions": "off",
      "prettier/prettier": "off",
      "prettier-vue/prettier": "warn",
      "vue/html-self-closing": "off",
    },
  },
];
