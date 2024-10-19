import js from "@eslint/js";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  //
  //
  // Configs and Plugins
  //
  js.configs.recommended, // Recommended config applied to all files
  // TODO: plugins import pluginNoAutofix
  // ...pluginVue.configs["flat/essential"],
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
];
