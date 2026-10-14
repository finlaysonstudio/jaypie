import jaypie from "@jaypie/eslint";

export default [
  //
  //
  // Jaypie
  //
  ...jaypie,

  //
  //
  // Global ignores
  //
  {
    ignores: [
      "**/prompts/templates/**",
      "LOCAL/**",
      "packages/express/docker/**",
      "workspaces/documentation/.astro/**",
      "workspaces/documentation/build/**",
      "workspaces/garden-ui/**",
    ],
  },

  //
  //
  // Tests: CDK assertions (Template.has*, resourceCountIs) are assertions
  //
  {
    files: ["packages/constructs/**/*.spec.ts"],
    rules: {
      "vitest/expect-expect": [
        "warn",
        {
          assertFunctionNames: [
            "expect",
            "expect.*",
            "*.hasCondition",
            "*.hasError",
            "*.hasMapping",
            "*.hasOutput",
            "*.hasResource",
            "*.hasResourceProperties",
            "*.hasWarning",
            "*.resourceCountIs",
            "*.resourcePropertiesCountIs",
            "*.templateMatches",
          ],
        },
      ],
    },
  },

  //
  //
  // Scripts: CLIs report on the console
  //
  {
    files: ["bin/**", "workspaces/documentation/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },

  //
  //
  // Sites: CommonJS
  //
  {
    files: ["workspaces/**/*.js"],
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
];
