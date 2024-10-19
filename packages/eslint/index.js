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
  js.configs.recommended, // Recommended config applied to all files
  ...pluginVue.configs["flat/essential"],
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

  //
  //
  // Vue
  //
  {
    files: ["**/*.vue"],
    plugins: {
      "prettier-vue": pluginPrettierVue,
    },
    rules: {
      "prettier/prettier": "off",
      "prettier-vue/prettier": "error",
    },
  },
  {
    files: [
      "packages/*-vue/**/*.js",
      "packages/*-vue/**/*.mjs",
      "packages/*-vue/**/*.vue",
      "packages/vue/**/*.js",
      "packages/vue/**/*.mjs",
      "packages/vue/**/*.vue",
      "packages/vue-*/**/*.js",
      "packages/vue-*/**/*.mjs",
      "packages/vue-*/**/*.vue",
      "vue/**/*.js",
      "vue/**/*.mjs",
      "vue/**/*.vue",
    ],
    rules: {
      taco: "error",
    },
  },
];
