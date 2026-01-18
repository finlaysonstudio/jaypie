import { fabricService } from "../service.js";
import type { Service, ServiceConfig, ServiceContext } from "../types.js";

import { validateAuthorization } from "./authorization.js";
import { defaultHttpTransform } from "./httpTransform.js";
import type {
  FabricHttpConfig,
  FabricHttpService,
  HttpContext,
  HttpTransformFunction,
} from "./types.js";

/**
 * Check if a value is a fabricService (has $fabric property)
 */
function isFabricService<TInput extends Record<string, unknown>, TOutput>(
  value: unknown,
): value is Service<TInput, TOutput> {
  return (
    typeof value === "function" &&
    "$fabric" in value &&
    typeof (value as Service<TInput, TOutput>).$fabric === "string"
  );
}

/**
 * Extended service context with auth information
 */
export interface HttpServiceContext<TAuth = unknown> extends ServiceContext {
  /** Authorization result (returned from authorization function) */
  auth?: TAuth;
  /** HTTP context for advanced use cases */
  http?: HttpContext;
}

/**
 * Create an HTTP-aware fabric service
 *
 * Extends fabricService with:
 * - HTTP context transformation (body, headers, method, path, query, params)
 * - Authorization handling (token extraction from Authorization header)
 * - CORS configuration (enabled by default)
 *
 * Accepts either:
 * - Inline service definition (with `service` function)
 * - Pre-built `fabricService` instance (via `service` property)
 */
export function fabricHttp<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
>(
  config: FabricHttpConfig<TInput, TOutput, TAuth>,
): FabricHttpService<TInput, TOutput, TAuth> {
  const {
    authorization = false,
    cors = true,
    http = defaultHttpTransform as HttpTransformFunction<TInput>,
    service: serviceConfig,
    stream = false,
    ...baseConfig
  } = config;

  // Resolve the underlying service
  let underlyingService: Service<TInput, TOutput>;

  if (isFabricService<TInput, TOutput>(serviceConfig)) {
    // Pre-built fabricService - merge configs
    underlyingService = serviceConfig;

    // Merge base config properties from the pre-built service
    if (
      baseConfig.alias === undefined &&
      underlyingService.alias !== undefined
    ) {
      baseConfig.alias = underlyingService.alias;
    }
    if (
      baseConfig.description === undefined &&
      underlyingService.description !== undefined
    ) {
      baseConfig.description = underlyingService.description;
    }
    if (
      baseConfig.input === undefined &&
      underlyingService.input !== undefined
    ) {
      baseConfig.input = underlyingService.input;
    }
  } else {
    // Inline service definition or plain function
    const serviceFunction = serviceConfig as ServiceConfig<
      TInput,
      TOutput
    >["service"];
    underlyingService = fabricService<TInput, TOutput>({
      ...baseConfig,
      service: serviceFunction,
    } as ServiceConfig<TInput, TOutput>);
  }

  // Create the HTTP handler that processes HTTP context
  const httpHandler = async (
    input?: Partial<TInput> | string,
    context?: HttpServiceContext<TAuth>,
  ): Promise<TOutput> => {
    // If context has HTTP info, process authorization
    // (HTTP context is added by the adapter layer like fabricExpress)
    if (context?.http && authorization !== false) {
      const authResult = await validateAuthorization<TAuth>(
        context.http.headers,
        authorization,
      );
      // Add auth result to context
      (context as HttpServiceContext<TAuth>).auth = authResult;
    }

    // Call the underlying service
    return underlyingService(input, context);
  };

  // Create the HTTP service with all properties
  const httpService = httpHandler as FabricHttpService<TInput, TOutput, TAuth>;

  // Copy properties from config (which may have been merged with underlying service)
  httpService.$fabric = underlyingService.$fabric;

  // Use baseConfig values (which include overrides) or fall back to underlying service
  const resolvedAlias = baseConfig.alias ?? underlyingService.alias;
  const resolvedDescription =
    baseConfig.description ?? underlyingService.description;
  const resolvedInput = baseConfig.input ?? underlyingService.input;

  if (resolvedAlias !== undefined) {
    httpService.alias = resolvedAlias;
  }
  if (resolvedDescription !== undefined) {
    httpService.description = resolvedDescription;
  }
  if (resolvedInput !== undefined) {
    httpService.input = resolvedInput;
  }
  if (underlyingService.service !== undefined) {
    httpService.service = underlyingService.service;
  }

  // Add HTTP-specific properties
  httpService.authorization = authorization;
  httpService.cors = cors;
  httpService.http = http;
  httpService.stream = stream;

  return httpService;
}

/**
 * Check if a service is an HTTP service (has http, authorization, cors properties)
 */
export function isFabricHttpService<
  TInput extends Record<string, unknown>,
  TOutput,
  TAuth,
>(value: unknown): value is FabricHttpService<TInput, TOutput, TAuth> {
  return (
    isFabricService<TInput, TOutput>(value) &&
    "authorization" in value &&
    "cors" in value &&
    "http" in value &&
    "stream" in value
  );
}
