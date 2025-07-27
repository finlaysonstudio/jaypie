---
trigger: model_decision
description: When asked to create a new workspace or subpackage for express, usually packages/express, to run as serverless Lambdas behind API Gateway
---

# Jaypie Initialize Express on Lambda Subpackage

## Process

1. Follow Jaypie_Init_Project_Subpackage.md:
   * Use @project-org/express in packages/express
   * This creates the basic subpackage structure with package.json, tsconfig.json, and vitest config files

2. Copy Express-specific template files:
   * Copy `prompts/templates/express-subpackage/index.ts` to `packages/express/index.ts`
   * Copy `prompts/templates/express-subpackage/src/app.ts` to `packages/express/src/app.ts`
   * Copy `prompts/templates/express-subpackage/src/handler.config.ts` to `packages/express/src/handler.config.ts`
   * Copy `prompts/templates/express-subpackage/src/routes/resource.router.ts` to `packages/express/src/routes/resource.router.ts`
   * Copy `prompts/templates/express-subpackage/src/routes/resource/resourceGet.route.ts` to `packages/express/src/routes/resource/resourceGet.route.ts`
   * Copy `prompts/templates/express-subpackage/src/routes/resource/__tests__/resourceGet.route.spec.ts` to `packages/express/src/routes/resource/__tests__/resourceGet.route.spec.ts`
   * Copy `prompts/templates/express-subpackage/src/types/express.ts` to `packages/express/src/types/express.ts`

3. Update package.json scripts:
   * Modify the existing scripts section to include:
     * `"dev": "tsx watch index.ts"`
     * `"start": "node dist/index.js"`
     * `"build": "tsc"`
   * Run `npm run format:package`

4. Install dependencies:
   * `npm --workspace ./packages/express install jaypie express @codegenie/serverless-express`
   * `npm --workspace ./packages/express install --save-dev @types/express @types/cors`
   * Always run `npm install`, never update package.json with dependencies from memory

5. Update TypeScript configuration:
   * Update packages/express/tsconfig.json to include index.ts in the include array: `"include": ["src/**/*", "index.ts"]`
   * Change exclude to: `"exclude": ["node_modules", "dist", "**/*.spec.ts"]`
   * Test the build
   * Ensure dist/ is in gitignore

6. Update the top-level package.json:
   * Add `"dev:express": "npm --workspace packages/express run dev"` and `"start:express": "npm --workspace packages/express run start"`
   * If there is no stand-alone `dev` or `start`, create a `dev` running `dev:express` and `start` running `start:express`
   * If `dev` or `start` exist, add calls to express if it fits the goal of the current commands

## Pattern

- TypeScript with ES modules (`"type": "module"`)
- Handler pattern: configuration → lifecycle → processing → response
- Optional `handlerConfig` for shared configuration and lifecycle management
- Clean separation of concerns with middleware patterns
- Lambda-optimized Express configuration

## Structure

```
express/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
├── index.ts
├── src/
│   ├── app.ts
│   ├── handler.config.ts
│   ├── routes/
│   │   ├── resource.router.ts
│   │   └── resource/
│   │       ├── resourceGet.route.ts
│   │       └── __tests__/
│   │           └── resourceGet.route.spec.ts
│   └── types/
│       └── express.ts
└── dist/
```

## Local Development

### Listening on Port 8080

A local entrypoint, usually index.ts, may check `process.env.NODE_ENV === "development"` and be allowed to listen on port 8080 (preserving 3000 for front ends).
`npm run dev:express` should be configured to initialize this mode locally.

## Version Compatibility

Jaypie uses Express 4.
There is no immediately planned upgrade to Express 5.