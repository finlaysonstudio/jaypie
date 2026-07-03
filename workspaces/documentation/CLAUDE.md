# @jaypie/documentation

Documentation stack for the Jaypie monorepo, built with Astro + Starlight and deployed via CDK.

## Purpose

This package generates and hosts the public documentation at https://jaypie.net. It includes:
- API reference documentation for all Jaypie packages
- Getting started guides and tutorials
- Package overviews and architecture documentation

## Directory Structure

```
documentation/
├── api-extractor.json    # API Extractor configuration template
├── astro.config.mjs      # Astro + Starlight site configuration (sidebar lives here)
├── public/
│   └── img/              # Static assets served as-is (logo)
├── scripts/
│   └── extract-api.ts    # API extraction script
├── src/
│   ├── assets/           # Images processed by Astro (logo for header)
│   ├── components/
│   │   └── Footer.astro  # Starlight Footer override (link columns + copyright)
│   ├── content/
│   │   └── docs/
│   │       └── docs/     # Markdown documentation source (URL base /docs/)
│   │           ├── api/  # Per-package API reference (*.md)
│   │           └── index.md  # Introduction (served at /docs/)
│   ├── content.config.ts # Content collection (Starlight docsLoader/docsSchema)
│   ├── pages/
│   │   └── index.astro   # Standalone landing page (served at /)
│   └── styles/
│       └── custom.css    # Starlight theme overrides (fonts, amber/warm palette)
└── tsconfig.json
```

## Commands

```bash
npm run start             # Start dev server with hot reload (port 3060)
npm run build             # Build static site to /build
npm run serve             # Preview built site locally (port 3060)
npm run extract           # Extract API docs from TypeScript packages
npm run typecheck         # astro check (types + .astro diagnostics)
```

## Content Conventions

- Docs are plain Markdown in `src/content/docs/docs/`; the extra `docs/` level keeps URLs at `/docs/...`
- Starlight requires `title` in frontmatter and renders it as the page H1 — do not add an H1 in the body
- Sidebar order and grouping are defined in `astro.config.mjs` (`sidebar` option), not frontmatter
- Use `:::note`, `:::tip`, `:::caution`, `:::danger` asides (Docusaurus `:::warning` is not valid — use `:::caution`)
- Internal links are absolute with trailing slash: `/docs/core/logging/`
- Search is built-in (Pagefind) — no configuration needed

## API Documentation Workflow

The `extract` script uses Microsoft's API Extractor to generate documentation from TypeScript packages:

1. Reads `.d.ts` files from built packages in `../../packages/*/dist/`
2. Generates `.api.json` files in `temp/` directory
3. Supports packages: constructs, errors, kit, llm, logger, mcp, testkit, textract, types, webkit

**Important**: Packages must be built before running `extract`.

## Adding Documentation

### New Package API Reference

1. Create `src/content/docs/docs/api/<package-name>.md` with `title` frontmatter
2. Optionally add a sidebar entry in `astro.config.mjs` (api pages are currently not in the sidebar)
3. Add to `TS_PACKAGES` array in `scripts/extract-api.ts` if TypeScript package

### Updating Homepage

Edit `src/pages/index.astro` to modify hero, capabilities, package tables, or pattern snippets. It is a standalone page (no Starlight chrome) that reads the Starlight theme from localStorage for light/dark parity.

## Configuration

### Site Settings (astro.config.mjs)

- **URL**: https://jaypie.net
- **Output**: `./build` (synced to S3 by deploy workflows — do not change)
- **Trailing slashes**: `always` (matches S3 website-endpoint folder redirects)
- **Theme**: Starlight with custom CSS (dark default, light optional)

## Theming

Starlight CSS custom properties are mapped in `src/styles/custom.css`:
- Fonts: Faculty Glyphic (brand), Inter (headings), Noto Sans (body), Noto Sans Mono (code)
- Dark (default): warm neutrals background, amber accent
- Light: inverted warm neutrals, amber-500 accent

## Notes

- This package is `private: true` and not published to npm
- Deployed by `deploy-env-*.yml` workflows: CDK stack `JaypieDocumentation` (S3 + CloudFront), then `aws s3 sync build/`
- The generated `.astro/` directory is ESLint-ignored (root `eslint.config.mjs`) and gitignored
