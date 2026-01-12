import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Jaypie is TypeScript AWS/CDK + Datadog Application Patterns",
  tagline:
    "Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.",
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

  headTags: [
    {
      tagName: "meta",
      attributes: {
        property: "og:title",
        content: "Jaypie is TypeScript AWS/CDK + Datadog Application Patterns",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:description",
        content:
          "Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:type",
        content: "website",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:url",
        content: "https://jaypie.finlayson.studio",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:image",
        content: "https://jaypie.finlayson.studio/img/jaypie-social-card.jpg",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:card",
        content: "summary_large_image",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:title",
        content: "Jaypie is TypeScript AWS/CDK + Datadog Application Patterns",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:description",
        content:
          "Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:image",
        content: "https://jaypie.finlayson.studio/img/jaypie-social-card.jpg",
      },
    },
  ],

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
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    image: "img/jaypie-social-card.jpg",
    navbar: {
      title: "Jaypie",
      logo: {
        alt: "Jaypie",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
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
          title: "Docs",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
            {
              label: "Core Concepts",
              to: "/docs/core/handler-lifecycle",
            },
            {
              label: "How-To Guides",
              to: "/docs/guides/express-lambda",
            },
            {
              label: "Architecture",
              to: "/docs/architecture/project-structure",
            },
          ],
        },
        {
          title: "Reference",
          items: [
            {
              label: "Packages",
              to: "/docs/packages/jaypie",
            },
            {
              label: "Experimental",
              to: "/docs/experimental/dynamodb",
            },
            {
              label: "Criticisms",
              to: "/docs/criticisms",
            },
          ],
        },
        {
          title: "Development",
          items: [
            {
              label: "Contributing",
              to: "/docs/contributing/development-process",
            },
            {
              label: "GitHub",
              href: "https://github.com/finlaysonstudio/jaypie",
            },
            {
              label: "Publisher",
              to: "/docs/publisher",
            },
          ],
        },
      ],
      copyright: `Published by Finlayson Studio. Released under the MIT License. Created with Docusaurus. Available on GitHub.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
