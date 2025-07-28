import jaypie from "@jaypie/eslint";
import jest from "eslint-plugin-jest";

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
    ignores: ["**/prompts/templates/**"],
  },

  //
  //
  // CDK: CommonJS and Jest
  //
  {
    files: ["packages/cdk/**/*.js"],
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
  {
    files: [
      "packages/cdk/**/*.spec.js",
      "packages/cdk/**/*.test.js",
      "packages/cdk/**/__tests__/**/*.js",
    ],
    ...jest.configs["flat/recommended"],
  },
  
  //
  //
  // MCP: Allow gray-matter import
  //
  {
    files: ["packages/mcp/**/*.ts"],
    rules: {
      "import-x/no-unresolved": ["error", { ignore: ["gray-matter"] }],
    },
  },
];
