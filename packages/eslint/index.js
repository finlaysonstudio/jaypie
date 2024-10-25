import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

export default [
  //
  //
  // Configs and Plugins
  //
  js.configs.recommended, // Recommended config applied to all files

  stylistic.configs.customize({
    // the following options are the default values
    braceStyle: "1tbs",
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: false,
  }),

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
      globals: globals.node,
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
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-unused-vars": "warn",
      "no-use-before-define": [
        "error",
        { functions: true, classes: true, variables: true },
      ],
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

  //
  //
  // Vue
  //
  {
    ignores: [
      "packages/*-vue/**/*.js",
      "packages/*-vue/**/*.mjs",
      "packages/*-vue/**/*.mts",
      "packages/*-vue/**/*.ts",
      "packages/*-vue/**/*.vue",
      "packages/vue/**/*.js",
      "packages/vue/**/*.mjs",
      "packages/vue/**/*.mts",
      "packages/vue/**/*.ts",
      "packages/vue/**/*.vue",
      "packages/vue-*/**/*.js",
      "packages/vue-*/**/*.mjs",
      "packages/vue-*/**/*.mts",
      "packages/vue-*/**/*.ts",
      "packages/vue-*/**/*.vue",
      "vue/**/*.js",
      "vue/**/*.mjs",
      "vue/**/*.mts",
      "vue/**/*.ts",
      "vue/**/*.vue",
    ],
  },
];
