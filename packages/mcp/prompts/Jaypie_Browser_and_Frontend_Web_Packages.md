---
description: limitations of Jaypie in the frontend and project structure
globs: packages/nuxt/**
---

# Jaypie Browser and Frontend Web Packages

`@jaypie/webkit` exists as a front-end package but only wraps `@jaypie/errors`.
`@jaypie/core` is not compatible with the browser.
In particular, frontend logging does not follow Jaypie conventions.

Jaypie Nuxt apps are usually in `packages/nuxt` or similar.
Apps may be declaring a logger like `useLog` in `app/composables/` that can be declared with `import { useLog } from "~/composables/useLog"`
In this case, initialize `log = useLog()`, and call trace, debug, info, warn, and error functions with a single string message or single key-value variable. For example, log.trace("Hello") or log.debug({ name: "World" }).
Prefer trace for anything on the "happy path" and debug off-path.
Avoid console.log unless working tests.
This may pull from a plugin like `app/plugins/`.
`datadog.client.ts` may provide a logger connected to Datadog.