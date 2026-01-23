// ServiceSuite for @jaypie/fabric
// Groups fabricService instances for discovery, metadata export, and direct execution

import type { InputFieldDefinition, Service } from "./types.js";

/**
 * Describes a single input parameter for a service
 */
export interface ServiceInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
}

/**
 * Describes a service's metadata for discovery and documentation
 */
export interface ServiceMeta {
  /** Service name (from alias) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping (e.g., "record", "aws", "docs") */
  category: string;
  /** Input parameter definitions */
  inputs: ServiceInput[];
  /** Whether the service can be executed with no inputs */
  executable?: boolean;
}

/**
 * A collection of services with metadata and execution capabilities
 */
export interface ServiceSuite {
  /** Suite name (e.g., "nostrus", "jaypie") */
  name: string;
  /** Suite version */
  version: string;
  /** Available categories */
  categories: string[];
  /** All registered services */
  services: ServiceMeta[];

  /** Get a service by name */
  getService(name: string): ServiceMeta | undefined;
  /** Get services by category */
  getServicesByCategory(category: string): ServiceMeta[];

  /** Execute a service by name */
  execute(name: string, inputs: Record<string, unknown>): Promise<unknown>;

  /** Register a fabricService into the suite */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(service: Service<any, any>, options: { category: string }): void;

  /** Get all registered service functions (for transport adapters like FabricMcpServer) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getServiceFunctions(): Service<any, any>[];

  /** Get a specific service function by name */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getServiceFunction(name: string): Service<any, any> | undefined;
}

/**
 * Configuration for creating a ServiceSuite
 */
export interface CreateServiceSuiteConfig {
  name: string;
  version: string;
}

/**
 * Derive type string from InputFieldDefinition.type
 */
function deriveTypeString(type: InputFieldDefinition["type"]): string {
  // Handle constructors
  if (type === String || type === "string") return "string";
  if (type === Number || type === "number") return "number";
  if (type === Boolean || type === "boolean") return "boolean";
  if (type === Object || type === "object") return "object";
  if (type === Array || type === "array") return "array";
  if (type === Date) return "string"; // Dates are passed as strings

  // Handle typed arrays: [String], [Number], etc.
  if (Array.isArray(type)) {
    if (type.length === 0) return "array";
    const first = type[0];
    // If it's a type constructor, it's a typed array
    if (
      first === String ||
      first === Number ||
      first === Boolean ||
      first === Object ||
      first === "string" ||
      first === "number" ||
      first === "boolean" ||
      first === "object" ||
      first === ""
    ) {
      return "array";
    }
    // If all elements are strings (or RegExp), it's a validated string enum
    if (type.every((item) => typeof item === "string" || item instanceof RegExp)) {
      return "string";
    }
    // If all elements are numbers, it's a validated number enum
    if (type.every((item) => typeof item === "number")) {
      return "number";
    }
    return "array";
  }

  // Handle RegExp (validated string)
  if (type instanceof RegExp) {
    return "string";
  }

  return "string"; // Default fallback
}

/**
 * Extract enum values if the type is a validated string/number array
 */
function extractEnumValues(type: InputFieldDefinition["type"]): string[] | undefined {
  if (!Array.isArray(type)) return undefined;
  if (type.length === 0) return undefined;

  // Check if it's a validated string enum (array of strings, possibly with RegExp)
  const stringValues = type.filter((item): item is string => typeof item === "string");
  if (stringValues.length > 0 && stringValues.length === type.filter((item) => typeof item === "string").length) {
    // All non-RegExp items are strings
    return stringValues;
  }

  // Check if it's a validated number enum
  if (type.every((item) => typeof item === "number")) {
    return type.map((n) => String(n));
  }

  return undefined;
}

/**
 * Convert fabricService input definitions to ServiceInput array
 */
function extractInputs(
  inputDefinitions?: Record<string, InputFieldDefinition>,
): ServiceInput[] {
  if (!inputDefinitions) return [];

  return Object.entries(inputDefinitions).map(([name, def]) => {
    const required =
      def.required !== false && def.default === undefined;
    const enumValues = extractEnumValues(def.type);

    return {
      name,
      type: deriveTypeString(def.type),
      required,
      description: def.description || "",
      ...(enumValues && { enum: enumValues }),
    };
  });
}

/**
 * Check if a service has any required inputs
 */
function hasRequiredInputs(inputs: ServiceInput[]): boolean {
  return inputs.some((input) => input.required);
}

/**
 * Create a ServiceSuite instance
 */
export function createServiceSuite(config: CreateServiceSuiteConfig): ServiceSuite {
  const { name, version } = config;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceRegistry = new Map<string, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: Service<any, any>;
    meta: ServiceMeta;
  }>();
  const categorySet = new Set<string>();

  const suite: ServiceSuite = {
    name,
    version,

    get categories(): string[] {
      return Array.from(categorySet).sort();
    },

    get services(): ServiceMeta[] {
      return Array.from(serviceRegistry.values()).map((entry) => entry.meta);
    },

    getService(serviceName: string): ServiceMeta | undefined {
      return serviceRegistry.get(serviceName)?.meta;
    },

    getServicesByCategory(category: string): ServiceMeta[] {
      return Array.from(serviceRegistry.values())
        .filter((entry) => entry.meta.category === category)
        .map((entry) => entry.meta);
    },

    async execute(
      serviceName: string,
      inputs: Record<string, unknown>,
    ): Promise<unknown> {
      const entry = serviceRegistry.get(serviceName);
      if (!entry) {
        throw new Error(`Service "${serviceName}" not found in suite "${name}"`);
      }
      return entry.service(inputs);
    },

    register(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: Service<any, any>,
      options: { category: string },
    ): void {
      const { category } = options;
      const serviceName = service.alias;
      if (!serviceName) {
        throw new Error("Service must have an alias to be registered");
      }

      const inputs = extractInputs(service.input);
      const meta: ServiceMeta = {
        name: serviceName,
        description: service.description || "",
        category,
        inputs,
        executable: !hasRequiredInputs(inputs),
      };

      serviceRegistry.set(serviceName, { service, meta });
      categorySet.add(category);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServiceFunctions(): Service<any, any>[] {
      return Array.from(serviceRegistry.values()).map((entry) => entry.service);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServiceFunction(serviceName: string): Service<any, any> | undefined {
      return serviceRegistry.get(serviceName)?.service;
    },
  };

  return suite;
}
