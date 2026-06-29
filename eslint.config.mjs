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
      "workspaces/documentation/.docusaurus/**",
      "workspaces/documentation/build/**",
      "workspaces/garden-ui/**",
    ],
  },

  //
  //
  // Sites: TypeScript/TSX files (allow imports)
  //
  {
    files: ["workspaces/**/*.ts", "workspaces/**/*.tsx"],
    rules: {
      "import-x/default": "off",
      "import-x/no-unresolved": [
        "error",
        { ignore: ["^@theme/", "^@docusaurus/"] },
      ],
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
