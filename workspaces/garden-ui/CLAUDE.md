# @jaypie/garden-ui

Jaypie Garden UI site deployed via CDK.

## Purpose

This package hosts the Jaypie Garden UI frontend site with Auth0 authentication, user management, API key administration, and device session tracking.

## Directory Structure

```
garden-ui/
├── next.config.mjs       # Next.js configuration
├── src/
│   ├── app/
│   │   ├── api/apikeys/  # API key CRUD route handler
│   │   ├── apikeys/      # API keys admin page
│   │   ├── colors/       # Color palette page (registered)
│   │   ├── components/   # Components page (registered)
│   │   ├── context/      # Context route (auth status, permissions, session)
│   │   ├── dimensions/   # Dimensions page (registered)
│   │   ├── fonts/        # Fonts page (registered)
│   │   ├── layout/       # Layout page (registered)
│   │   ├── globals.css   # Global styles with Jaypie design system
│   │   ├── layout.tsx    # Root layout
│   │   ├── NavMenu.tsx   # Navigation with auth UI
│   │   ├── page.module.css
│   │   └── page.tsx      # Home page (public)
│   ├── lib/
│   │   ├── auth0.ts      # Auth0Client with onCallback user upsert
│   │   ├── colors.ts     # Jaypie color palette definitions
│   │   ├── session.ts    # Garden session model (device tracking)
│   │   ├── useStatus.ts  # Client auth state hook
│   │   └── user/
│   │       ├── permissions.ts  # hasPermission, hasAllPermissions, hasAnyPermission
│   │       └── upsert.ts      # User model registration and upsert
│   └── middleware.ts     # Auth0 middleware, route protection, session creation
└── tsconfig.json
```

## Authentication

- **Auth0** is the sole authentication method
- Middleware protects registered routes (redirects to `/auth/login`)
- `onCallback` hook creates/updates user records and links garden sessions
- Middleware runtime is `nodejs` (not Edge) for DynamoDB access

## Permissions

- Users get `["registered:*"]` on first Auth0 login
- Admin users have `"admin:*"` (manually set in DynamoDB)
- API keys inherit creator's permissions
- `hasPermission(userPermissions, "namespace:action")` supports `namespace:*` and `*` wildcards

## API Response Format

All API routes follow `{ data }` / `{ errors }` envelope (see `skill("api")`).

## Shared Concerns with garden-api

> **Keep in sync.** The following patterns are duplicated between `garden-ui` and `garden-api`. When changing one, update the other. Consider abstracting shared logic to a `garden-kit` workspace package.

| Concern | garden-ui | garden-api |
|---------|-----------|-----------|
| API key model registration | `src/app/api/apikeys/route.ts` | `src/apikey/validate.ts` |
| API key format validation | `validateJaypieKey({ issuer: "jaypie" })` | same |
| API key hashing | `hashJaypieKey(token)` (PROJECT_SALT) | same |
| Bearer token extraction | — | `src/apikey/validate.ts` |

### Candidates for garden-kit

- `apikey` model registration and indexes
- `validateApiKey(token)` — format check + hash + DynamoDB lookup
- `extractToken(authorization)` — Bearer token extraction
- Shared constants (`GARDEN_KEY_OPTIONS`)

## Design System

### Colors

The Jaypie color palette is defined in `src/lib/colors.ts`.

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
npm run dev               # Start dev server with hot reload (loads root .env)
npm run build             # Build standalone server to .next/standalone/
npm run start             # Start production server
npm run typecheck         # Type check code
npm run lint              # Lint code
```

## Notes

- This package is `private: true` and not published to npm
- Uses Next.js App Router with standalone output for Lambda SSR deployment
- Dev script sources root `.env` via `set -a && . ../../.env && set +a`
- Secrets loaded: `AUTH0_SECRET`, `PROJECT_SALT`
