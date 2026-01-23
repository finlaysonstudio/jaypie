// Resolve inline service definitions to full Service objects

import { fabricService, isService } from "./service.js";
import type {
  InputFieldDefinition,
  SerializerFunction,
  Service,
  ServiceFunction,
} from "./types.js";

/**
 * Configuration for resolving a service
 */
export interface ResolveServiceConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TSerializedOutput = TOutput,
> {
  /** Service alias (used as name for adapters) */
  alias?: string;
  /** Service description */
  description?: string;
  /** Input field definitions */
  input?: Record<string, InputFieldDefinition>;
  /** Serializer function - runs after service */
  serializer?: SerializerFunction<TInput, TOutput, TSerializedOutput>;
  /** The service - either a pre-instantiated Service or an inline function */
  service:
    | Service<TInput, TOutput, TSerializedOutput>
    | ServiceFunction<TInput, TOutput>;
}

/**
 * Resolve a service configuration to a full Service object
 *
 * Supports two patterns:
 * 1. Inline service definition - pass a plain function as `service` along with
 *    `alias`, `description`, and `input` in the config
 * 2. Pre-instantiated Service - pass a Service object as `service`
 *
 * When a pre-instantiated Service is passed, config fields act as overrides:
 * - `alias` overrides service.alias
 * - `description` overrides service.description
 * - `input` overrides service.input
 * - `serializer` overrides service.serializer
 *
 * The original Service is never mutated - a new Service is created when overrides
 * are applied.
 *
 * @example
 * ```typescript
 * // Inline service definition
 * const service = resolveService({
 *   alias: "greet",
 *   description: "Greet a user",
 *   input: { name: { type: String } },
 *   service: ({ name }) => `Hello, ${name}!`,
 * });
 *
 * // Pre-instantiated with override
 * const baseService = fabricService({ alias: "foo", service: (x) => x });
 * const overridden = resolveService({
 *   alias: "bar",  // Override alias
 *   service: baseService,
 * });
 * ```
 */
export function resolveService<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TSerializedOutput = TOutput,
>(
  config: ResolveServiceConfig<TInput, TOutput, TSerializedOutput>,
): Service<TInput, TOutput, TSerializedOutput> {
  const { alias, description, input, serializer, service } = config;

  if (isService<TInput, TOutput, TSerializedOutput>(service)) {
    // Service is pre-instantiated - config fields act as overrides
    // Create new Service with merged properties (config overrides service)
    return fabricService({
      alias: alias ?? service.alias,
      description: description ?? service.description,
      input: input ?? service.input,
      serializer: serializer ?? service.serializer,
      service: service.service,
    });
  }

  // Service is an inline function - create Service from config
  return fabricService({
    alias,
    description,
    input,
    serializer,
    service,
  });
}
