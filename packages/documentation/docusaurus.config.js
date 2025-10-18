const { themes: prismThemes } = require("prism-react-renderer");

const config = {
  title: "Jaypie",
  tagline: "Event-driven fullstack JavaScript framework for AWS",
  favicon: "img/favicon.ico",

  url: "https://jaypie.finlayson.studio",
  baseUrl: "/",

  organizationName: "finlaysonstudio",
  projectName: "jaypie",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  trailingSlash: false,

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.js",
          editUrl: "https://github.com/finlaysonstudio/jaypie/tree/main/packages/documentation/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
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
          title: "Docs",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "Packages",
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
              label: "LLM",
              to: "/docs/api/llm",
            },
            {
              label: "AWS",
              to: "/docs/api/aws",
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
      copyright: `Copyright © ${new Date().getFullYear()} Finlayson Studio. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

module.exports = config;
