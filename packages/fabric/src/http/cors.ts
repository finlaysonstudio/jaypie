import type {
  CorsConfig,
  CorsHeaders,
  CorsOption,
  HttpMethod,
} from "./types.js";

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  origin: "*",
  credentials: false,
  headers: ["Content-Type", "Authorization"],
  exposeHeaders: [],
  maxAge: 86400, // 24 hours
};

/**
 * Default allowed methods for CORS
 */
export const DEFAULT_CORS_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "DELETE",
  "OPTIONS",
];

/**
 * Normalize CORS option to CorsConfig
 * - true → default config
 * - false → disabled (returns undefined)
 * - CorsConfig → merged with defaults
 */
export function normalizeCorsConfig(
  option: CorsOption | undefined,
): CorsConfig | undefined {
  // Undefined or true → use defaults
  if (option === undefined || option === true) {
    return { ...DEFAULT_CORS_CONFIG };
  }

  // False → disabled
  if (option === false) {
    return undefined;
  }

  // Merge with defaults
  return {
    ...DEFAULT_CORS_CONFIG,
    ...option,
  };
}

/**
 * Get the allowed origin for a request
 * @param config - CORS configuration
 * @param requestOrigin - Origin header from request
 * @returns The origin to allow, or undefined if not allowed
 */
export function getAllowedOrigin(
  config: CorsConfig,
  requestOrigin: string | null,
): string | undefined {
  const { origin } = config;

  // Wildcard allows all
  if (origin === "*") {
    return "*";
  }

  // No origin in request
  if (!requestOrigin) {
    return undefined;
  }

  // Array of allowed origins
  if (Array.isArray(origin)) {
    if (origin.includes(requestOrigin)) {
      return requestOrigin;
    }
    return undefined;
  }

  // Single origin string
  if (origin === requestOrigin) {
    return requestOrigin;
  }

  return undefined;
}

/**
 * Build CORS headers for a response
 * @param config - CORS configuration
 * @param requestOrigin - Origin header from request
 * @param methods - Allowed HTTP methods
 * @returns Object with CORS headers, or empty object if CORS is disabled
 */
export function buildCorsHeaders(
  config: CorsConfig | undefined,
  requestOrigin: string | null,
  methods: HttpMethod[] = DEFAULT_CORS_METHODS,
): CorsHeaders {
  if (!config) {
    return {};
  }

  const headers: CorsHeaders = {};

  // Access-Control-Allow-Origin
  const allowedOrigin = getAllowedOrigin(config, requestOrigin);
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  // Access-Control-Allow-Methods
  headers["Access-Control-Allow-Methods"] = methods.join(", ");

  // Access-Control-Allow-Headers
  if (config.headers && config.headers.length > 0) {
    headers["Access-Control-Allow-Headers"] = config.headers.join(", ");
  }

  // Access-Control-Allow-Credentials
  if (config.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  // Access-Control-Expose-Headers
  if (config.exposeHeaders && config.exposeHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = config.exposeHeaders.join(", ");
  }

  // Access-Control-Max-Age
  if (config.maxAge !== undefined) {
    headers["Access-Control-Max-Age"] = String(config.maxAge);
  }

  return headers;
}

/**
 * Check if request is a CORS preflight request
 */
export function isPreflightRequest(method: string, headers: Headers): boolean {
  return (
    method.toUpperCase() === "OPTIONS" &&
    headers.has("access-control-request-method")
  );
}

/**
 * Build preflight response headers
 * Includes all CORS headers needed for preflight response
 */
export function buildPreflightHeaders(
  config: CorsConfig | undefined,
  requestOrigin: string | null,
  requestMethod: string | null,
  requestHeaders: string | null,
  methods: HttpMethod[] = DEFAULT_CORS_METHODS,
): CorsHeaders {
  if (!config) {
    return {};
  }

  const headers = buildCorsHeaders(config, requestOrigin, methods);

  // Include requested headers in response if not already covered
  if (requestHeaders) {
    const requestedHeaders = requestHeaders.split(",").map((h) => h.trim());
    const allowedHeaders = config.headers || [];
    const combinedHeaders = [
      ...new Set([...allowedHeaders, ...requestedHeaders]),
    ];
    headers["Access-Control-Allow-Headers"] = combinedHeaders.join(", ");
  }

  return headers;
}
