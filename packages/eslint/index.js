import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginPrettierVue from "eslint-plugin-prettier-vue";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";

export default [
  //
  //
  // Configs and Plugins
  //
  js.configs.recommended, // Recommended config applied to all files=
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
  // Rules
  //
  {
    rules: {
      "no-console": "warn",
      "no-fallthrough": "error",
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-unused-vars": "warn",
      "no-use-before-define": [
        "error",
        { functions: true, classes: true, variables: true },
      ],
      "object-shorthand": ["error", "always"],
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
  // {
  //   files: ["**/*.vue"],
  //   plugins: {
  //     "prettier-vue": pluginPrettierVue,
  //   },
  //   rules: {
  //     "prettier/prettier": "off",
  //     "prettier-vue/prettier": "error",
  //   },
  // },
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
