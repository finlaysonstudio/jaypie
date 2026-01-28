import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "link",
      label: "🐦‍⬛ Jaypie",
      href: "/",
    },
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "Core Concepts",
      items: [
        "core/handler-lifecycle",
        "core/error-handling",
        "core/logging",
        "core/environment",
      ],
    },
    {
      type: "category",
      label: "How-To Guides",
      items: [
        "guides/express-lambda",
        "guides/cdk-infrastructure",
        "guides/streaming",
        "guides/testing",
        "guides/llm-integration",
        "guides/cicd",
      ],
    },
    {
      type: "category",
      label: "Packages",
      items: [
        "packages/jaypie",
        "packages/express",
        "packages/lambda",
        "packages/constructs",
        "packages/llm",
        "packages/errors",
        "packages/logger",
        "packages/kit",
        "packages/testkit",
        "packages/eslint",
        "packages/repokit",
      ],
    },
    {
      type: "category",
      label: "Experimental",
      items: [
        "experimental/dynamodb",
        "experimental/fabric",
        "experimental/fabricator",
        "experimental/mcp",
        "experimental/textract",
        "experimental/tildeskill",
      ],
    },
    {
      type: "category",
      label: "Architecture",
      items: [
        "architecture/project-structure",
        "architecture/fabric-system",
        "architecture/patterns",
      ],
    },
    {
      type: "category",
      label: "Contributing",
      items: [
        "contributing/development-process",
        "contributing/branch-management",
        "contributing/writing-docs",
      ],
    },
    {
      type: "doc",
      id: "criticisms",
      label: "Criticisms",
    },
    {
      type: "doc",
      id: "publisher",
      label: "Publisher",
    },
  ],
};

export default sidebars;
