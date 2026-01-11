import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Jaypie",
  tagline: "Event-driven JavaScript library for AWS",
  favicon: "img/favicon.ico",

  url: "https://jaypie.finlayson.studio",
  baseUrl: "/",

  organizationName: "finlaysonstudio",
  projectName: "jaypie",

  onBrokenLinks: "warn",

  trailingSlash: false,

  markdown: {
    format: "mdx",
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/finlaysonstudio/jaypie/tree/main/packages/documentation/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/jaypie-social-card.jpg",
    navbar: {
      title: "Jaypie",
      logo: {
        alt: "Jaypie Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          href: "https://github.com/finlaysonstudio/jaypie",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Main Packages",
          items: [
            {
              label: "Core",
              to: "/docs/api/core",
            },
            {
              label: "Express",
              to: "/docs/api/express",
            },
            {
              label: "Lambda",
              to: "/docs/api/lambda",
            },
            {
              label: "LLM",
              to: "/docs/api/llm",
            },
          ],
        },
        {
          title: "Extra Packages",
          items: [
            {
              label: "Constructs",
              to: "/docs/api/constructs",
            },
            {
              label: "MCP",
              to: "/docs/api/mcp",
            },
            {
              label: "Textract",
              to: "/docs/api/textract",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/finlaysonstudio/jaypie",
            },
            {
              label: "npm",
              href: "https://www.npmjs.com/package/@jaypie/jaypie",
            },
          ],
        },
      ],
      copyright: `Built with Docusaurus. Published by Finlayson Studio. Available under the MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
