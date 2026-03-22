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

## Adding a New Page

1. Create `src/app/<name>/page.tsx` and `src/app/<name>/<name>.module.css`
2. Use the standard page structure:

```tsx
"use client";
import { IconName } from "lucide-react";
import { NavMenu } from "../NavMenu";
import styles from "./<name>.module.css";

export default function MyPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={IconName} />
      <h1 className={styles.title}>Page Title</h1>
      {/* content */}
    </div>
  );
}
```

3. Required CSS (must include the 656px media query for nav clearance):

```css
.page {
  margin: 0 auto;
  max-width: 544px;
  min-height: 100vh;
  min-width: 176px;
  padding: 16px 16px 96px;
}

@media (min-width: 656px) {
  .page {
    margin: 0 auto 0 112px;
    padding-bottom: 16px;
  }
}

.title {
  color: var(--text-secondary-primary);
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 100;
  letter-spacing: 0.04em;
  margin-bottom: 24px;
  margin-top: 13px;
}
```

4. Add the page to `NavMenu.tsx`:
   - Public: add to `PUBLIC_NAV_ITEMS`
   - Registered (login required): add to `PROTECTED_NAV_ITEMS`
   - Admin only: add to `ADMIN_NAV_ITEMS` or `ADMIN_NAV_ITEMS_END`
5. If the page requires authentication, add the path to `PROTECTED_PATHS` in `src/middleware.ts`

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
