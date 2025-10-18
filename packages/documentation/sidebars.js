const sidebars = {
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
          label: "Core Packages",
          items: [
            {
              type: "doc",
              id: "api/core",
              label: "@jaypie/core",
            },
            {
              type: "doc",
              id: "api/express",
              label: "@jaypie/express",
            },
            {
              type: "doc",
              id: "api/lambda",
              label: "@jaypie/lambda",
            },
          ],
        },
        {
          type: "category",
          label: "Integration Packages",
          items: [
            {
              type: "doc",
              id: "api/aws",
              label: "@jaypie/aws",
            },
            {
              type: "doc",
              id: "api/llm",
              label: "@jaypie/llm",
            },
          ],
        },
        {
          type: "category",
          label: "Utility Packages",
          items: [
            {
              type: "doc",
              id: "api/errors",
              label: "@jaypie/errors",
            },
            {
              type: "doc",
              id: "api/testkit",
              label: "@jaypie/testkit",
            },
          ],
        },
      ],
    },
  ],
};

module.exports = sidebars;
