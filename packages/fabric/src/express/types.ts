import type { Request, RequestHandler, Response, Router } from "express";

import type {
  AuthorizationConfig,
  CorsOption,
  FabricHttpService,
  HttpMethod,
} from "../http/types.js";

// #region fabricExpress

/**
 * Configuration for fabricExpress middleware
 */
export interface FabricExpressConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
> {
  /** The fabric HTTP service to wrap */
  service: FabricHttpService<TInput, TOutput, TAuth>;
  /** Override path pattern (defaults to /${alias}) */
  path?: string;
  /** HTTP methods to handle (defaults to DEFAULT_HTTP_METHODS) */
  methods?: HttpMethod[];
}

/**
 * Express middleware returned by fabricExpress
 */
export interface FabricExpressMiddleware extends RequestHandler {
  /** The wrapped fabric HTTP service */
  service: FabricHttpService;
  /** Path pattern for the middleware */
  path: string;
  /** HTTP methods handled */
  methods: HttpMethod[];
}

// #endregion

// #region FabricRouter

/**
 * Service entry for FabricRouter - either a service or a config object
 */
export type FabricRouterServiceEntry<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
> =
  | FabricHttpService<TInput, TOutput, TAuth>
  | FabricExpressConfig<TInput, TOutput, TAuth>;

/**
 * Configuration for FabricRouter
 */
export interface FabricRouterConfig {
  /** Services to register in the router */
  services: FabricRouterServiceEntry[];
  /** Global authorization (applied to all services without their own) */
  authorization?: AuthorizationConfig;
  /** Global CORS configuration */
  cors?: CorsOption;
  /** Prefix for all routes (e.g., "/api" or "/v1") */
  prefix?: string;
}

/**
 * Extended Express Router with fabric metadata
 */
export interface FabricExpressRouter extends Router {
  /** Registered services */
  services: FabricHttpService[];
  /** Route prefix */
  prefix?: string;
}

// #endregion

// #region Express Types (re-exported for convenience)

export type { Request, Response, Router };

// #endregion
