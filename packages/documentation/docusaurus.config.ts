import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Jaypie",
  tagline: "Event-driven TypeScript for AWS",
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
          title: "Documentation",
          items: [
            {
              label: "Getting Started",
              to: "/docs/intro",
            },
            {
              label: "API Reference",
              to: "/docs/api/kit",
            },
          ],
        },
        {
          title: "Packages",
          items: [
            {
              label: "jaypie",
              to: "/docs/api/kit",
            },
            {
              label: "@jaypie/llm",
              to: "/docs/api/llm",
            },
            {
              label: "@jaypie/constructs",
              to: "/docs/api/constructs",
            },
            {
              label: "@jaypie/testkit",
              to: "/docs/api/testkit",
            },
          ],
        },
        {
          title: "Links",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/finlaysonstudio/jaypie",
            },
            {
              label: "npm",
              href: "https://www.npmjs.com/package/jaypie",
            },
          ],
        },
      ],
      copyright: `Finlayson Studio · MIT License`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
