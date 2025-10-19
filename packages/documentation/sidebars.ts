import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "API Reference",
      items: [
        {
          type: "category",
          label: "Main Packages",
          items: [
            {
              type: "doc",
              id: "api/aws",
              label: "@jaypie/aws",
            },
            {
              type: "doc",
              id: "api/core",
              label: "@jaypie/core",
            },
            {
              type: "doc",
              id: "api/datadog",
              label: "@jaypie/datadog",
            },
            {
              type: "doc",
              id: "api/errors",
              label: "@jaypie/errors",
            },
            {
              type: "doc",
              id: "api/express",
              label: "@jaypie/express",
            },
            {
              type: "doc",
              id: "api/kit",
              label: "@jaypie/kit",
            },
            {
              type: "doc",
              id: "api/lambda",
              label: "@jaypie/lambda",
            },
            {
              type: "doc",
              id: "api/llm",
              label: "@jaypie/llm",
            },
            {
              type: "doc",
              id: "api/logger",
              label: "@jaypie/logger",
            },
            {
              type: "doc",
              id: "api/mongoose",
              label: "@jaypie/mongoose",
            },
          ],
        },
        {
          type: "category",
          label: "Extra Packages",
          items: [
            {
              type: "doc",
              id: "api/constructs",
              label: "@jaypie/constructs",
            },
            {
              type: "doc",
              id: "api/mcp",
              label: "@jaypie/mcp",
            },
            {
              type: "doc",
              id: "api/textract",
              label: "@jaypie/textract",
            },
            {
              type: "doc",
              id: "api/webkit",
              label: "@jaypie/webkit",
            },
          ],
        },
        {
          type: "category",
          label: "Utility Packages",
          items: [
            {
              type: "doc",
              id: "api/eslint",
              label: "@jaypie/eslint",
            },
            {
              type: "doc",
              id: "api/testkit",
              label: "@jaypie/testkit",
            },
            {
              type: "doc",
              id: "api/types",
              label: "@jaypie/types",
            },
          ],
        },
        {
          type: "category",
          label: "Deprecated Packages",
          items: [
            {
              type: "doc",
              id: "api/cdk",
              label: "@jaypie/cdk",
            },
          ],
        },
      ],
    },
  ],
};

export default sidebars;
