# @jaypie/garden-nextjs

Jaypie Garden Next.js site deployed via CDK.

## Purpose

This package hosts the Jaypie Garden Next.js frontend site.

## Directory Structure

```
garden-nextjs/
├── next.config.mjs       # Next.js configuration
├── src/
│   ├── app/
│   │   ├── globals.css   # Global styles with Jaypie design system
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.module.css # Home page styles
│   │   └── page.tsx      # Home page component
│   └── lib/
│       └── colors.ts     # Jaypie color palette definitions
└── tsconfig.json         # TypeScript configuration
```

## Design System

### Colors

The Jaypie color palette is defined in `src/lib/colors.ts`:

- **zinc** - Background colors (dark theme backgrounds)
- **gray** - Foreground/text colors
- **brown** - Accent/bronze colors
- Standard colors: amber, blue, cyan, emerald, fuchsia, green, indigo, lime, orange, pink, purple, red, rose, sky, slate, teal, violet, yellow

### Typography

Font families available via CSS variables:
- `--font-brand` / `--font-heading` - Faculty Glyphic (display)
- `--font-body` - Noto Serif (body text)
- `--font-user` - Noto Sans (user-generated content)
- `--font-system` / `--font-ui` / `--font-footer` - Inter (UI elements)
- `--font-code` - Noto Sans Mono (code)

### Icons

Uses [Lucide React](https://lucide.dev) for icons.

## Commands

```bash
npm run dev               # Start dev server with hot reload
npm run build             # Build static site to /out
npm run start             # Start production server
npm run typecheck         # Type check code
npm run lint              # Lint code
```

## Notes

- This package is `private: true` and not published to npm
- Uses Next.js App Router with static export
- Output directory is `/out` for static hosting
