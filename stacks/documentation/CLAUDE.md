# @jaypie/documentation

Documentation stack for the Jaypie monorepo, built with Docusaurus and deployed via CDK.

## Purpose

This package generates and hosts the public documentation at https://jaypie.net. It includes:
- API reference documentation for all Jaypie packages
- Getting started guides and tutorials
- Package overviews and architecture documentation

## Directory Structure

```
documentation/
├── api-extractor.json    # API Extractor configuration template
├── docs/                 # Markdown documentation source
│   ├── api/              # Per-package API reference (*.md)
│   ├── index.md          # Documentation landing page
│   └── intro.md          # Introduction/getting started
├── docusaurus.config.ts  # Docusaurus site configuration
├── scripts/
│   └── extract-api.ts    # API extraction script
├── sidebars.ts           # Documentation sidebar navigation
├── src/
│   ├── css/
│   │   └── custom.css    # Global CSS overrides (Infima theming)
│   └── pages/
│       ├── index.tsx     # Homepage component
│       └── index.module.css
└── static/
    └── img/              # Static assets (logo, favicon, social card)
```

## Commands

```bash
npm run start             # Start dev server with hot reload
npm run build             # Build static site to /build
npm run serve             # Serve built site locally
npm run extract           # Extract API docs from TypeScript packages
npm run typecheck         # Type check documentation code
npm run clear             # Clear Docusaurus cache
```

## API Documentation Workflow

The `extract` script uses Microsoft's API Extractor to generate documentation from TypeScript packages:

1. Reads `.d.ts` files from built packages in `../*/dist/`
2. Generates `.api.json` files in `temp/` directory
3. Supports packages: constructs, errors, kit, llm, logger, mcp, testkit, textract, types, webkit

**Important**: Packages must be built before running `extract`.

## Adding Documentation

### New Package API Reference

1. Create `docs/api/<package-name>.md`
2. Add sidebar entry in `sidebars.ts` under appropriate category (Main, Extra, Utility, or Deprecated)
3. Optionally add footer link in `docusaurus.config.ts`
4. Add to `TS_PACKAGES` array in `scripts/extract-api.ts` if TypeScript package

### Updating Homepage

Edit `src/pages/index.tsx` to modify:
- Hero banner content
- Feature cards
- Quick start section

## Configuration

### Site Settings (docusaurus.config.ts)

- **URL**: https://jaypie.net
- **Organization**: finlaysonstudio
- **Project**: jaypie
- **Theme**: Classic preset with Prism syntax highlighting
- **Blog**: Disabled

### Sidebar Categories (sidebars.ts)

- Main Packages: aws, core, datadog, errors, express, kit, lambda, llm, logger, mongoose
- Extra Packages: constructs, mcp, textract
- Utility Packages: eslint, testkit, types
- Deprecated: cdk

## Theming

CSS variables are defined in `src/css/custom.css`:
- Light theme primary: `#2e8555` (green)
- Dark theme primary: `#25c2a0` (teal)

## Notes

- This package is `private: true` and not published to npm
- The `onBrokenLinks` setting is "warn" to allow documentation work-in-progress
- API documentation pages use MDX format for enhanced markdown features
