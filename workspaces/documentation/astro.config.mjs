import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const DESCRIPTION =
  "Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.";
const SOCIAL_CARD = "https://jaypie.net/img/jaypie-social-card.jpg";

export default defineConfig({
  integrations: [
    starlight({
      components: {
        Footer: "./src/components/Footer.astro",
      },
      customCss: ["./src/styles/custom.css"],
      description: DESCRIPTION,
      editLink: {
        baseUrl:
          "https://github.com/finlaysonstudio/jaypie/edit/main/workspaces/documentation/",
      },
      favicon: "/img/logo.svg",
      head: [
        {
          attrs: { content: SOCIAL_CARD, property: "og:image" },
          tag: "meta",
        },
        {
          attrs: { content: SOCIAL_CARD, name: "twitter:image" },
          tag: "meta",
        },
      ],
      logo: {
        alt: "Jaypie",
        src: "./src/assets/logo.svg",
      },
      sidebar: [
        { label: "🐦‍⬛ Jaypie", link: "/" },
        { label: "Introduction", slug: "docs" },
        {
          items: [
            "docs/core/handler-lifecycle",
            "docs/core/error-handling",
            "docs/core/logging",
            "docs/core/environment",
          ],
          label: "Core Concepts",
        },
        {
          items: [
            "docs/guides/express-lambda",
            "docs/guides/cdk-infrastructure",
            "docs/guides/streaming",
            "docs/guides/testing",
            "docs/guides/llm-integration",
            "docs/guides/cicd",
          ],
          label: "How-To Guides",
        },
        {
          items: [
            "docs/packages/jaypie",
            "docs/packages/express",
            "docs/packages/lambda",
            "docs/packages/constructs",
            "docs/packages/llm",
            "docs/packages/errors",
            "docs/packages/logger",
            "docs/packages/kit",
            "docs/packages/testkit",
            "docs/packages/eslint",
            "docs/packages/repokit",
          ],
          label: "Packages",
        },
        {
          items: [
            "docs/experimental/dynamodb",
            "docs/experimental/fabric",
            "docs/experimental/fabricator",
            "docs/experimental/mcp",
            "docs/experimental/textract",
            "docs/experimental/tildeskill",
          ],
          label: "Experimental",
        },
        {
          items: [
            "docs/architecture/project-structure",
            "docs/architecture/fabric-system",
            "docs/architecture/patterns",
          ],
          label: "Architecture",
        },
        {
          items: [
            "docs/contributing/development-process",
            "docs/contributing/branch-management",
            "docs/contributing/writing-docs",
          ],
          label: "Contributing",
        },
        { label: "Criticisms", slug: "docs/criticisms" },
        { label: "Publisher", slug: "docs/publisher" },
      ],
      social: [
        {
          href: "https://github.com/finlaysonstudio/jaypie",
          icon: "github",
          label: "GitHub",
        },
      ],
      title: "Jaypie",
    }),
  ],
  outDir: "./build",
  site: "https://jaypie.net",
  trailingSlash: "always",
});
