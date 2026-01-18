import { Router } from "express";

import { isFabricHttpService } from "../http/fabricHttp.js";
import type { FabricHttpService, HttpMethod } from "../http/types.js";
import { DEFAULT_HTTP_METHODS } from "../http/types.js";

import { fabricExpress } from "./fabricExpress.js";
import type {
  FabricExpressConfig,
  FabricExpressRouter,
  FabricRouterConfig,
  FabricRouterServiceEntry,
} from "./types.js";

/**
 * Check if entry is a FabricExpressConfig (has service property)
 */
function isServiceConfig(
  entry: FabricRouterServiceEntry,
): entry is FabricExpressConfig {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "service" in entry &&
    isFabricHttpService(entry.service)
  );
}

/**
 * Create an Express Router with multiple fabric services
 *
 * Provides a convenient way to mount multiple fabricHttp services:
 * - Auto-registers each service at /${alias}
 * - Supports custom path and method overrides per service
 * - Optionally applies a prefix to all routes
 *
 * @example
 * ```typescript
 * const router = FabricRouter({
 *   services: [
 *     userService,
 *     productService,
 *     { service: adminService, path: "/admin/:id", methods: ["POST"] },
 *   ],
 *   prefix: "/api",
 * });
 *
 * app.use(router);
 * // Routes: /api/users, /api/products, /api/admin/:id
 * ```
 */
export function FabricRouter(config: FabricRouterConfig): FabricExpressRouter {
  const { services, prefix } = config;

  // Create base router
  const router = Router() as FabricExpressRouter;

  // Track registered services
  const registeredServices: FabricHttpService[] = [];

  // Register each service
  for (const entry of services) {
    let service: FabricHttpService;
    let path: string | undefined;
    let methods: HttpMethod[] | undefined;

    if (isServiceConfig(entry)) {
      // Config object with service + overrides
      service = entry.service;
      path = entry.path;
      methods = entry.methods;
    } else if (isFabricHttpService(entry)) {
      // Direct service
      service = entry;
    } else {
      throw new Error(
        "FabricRouter: Each service entry must be a FabricHttpService or { service: FabricHttpService }",
      );
    }

    // Create middleware
    const middleware = fabricExpress({
      methods: methods ?? DEFAULT_HTTP_METHODS,
      path,
      service,
    });

    // Determine mount path
    const mountPath = middleware.path;

    // Register all methods for this path
    for (const method of middleware.methods) {
      const lowerMethod = method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "delete"
        | "patch"
        | "options";

      // Express router methods
      if (lowerMethod === "options") {
        // OPTIONS is handled by the middleware for preflight
        router.options(mountPath, middleware);
      } else {
        router[lowerMethod](mountPath, middleware);
      }
    }

    // Also handle OPTIONS for CORS preflight if not already included
    if (!middleware.methods.includes("OPTIONS")) {
      router.options(mountPath, middleware);
    }

    registeredServices.push(service);
  }

  // Attach metadata
  router.services = registeredServices;
  router.prefix = prefix;

  return router;
}

/**
 * Check if a value is a FabricExpressRouter
 */
export function isFabricExpressRouter(
  value: unknown,
): value is FabricExpressRouter {
  return (
    typeof value === "function" &&
    "services" in value &&
    Array.isArray((value as FabricExpressRouter).services)
  );
}
