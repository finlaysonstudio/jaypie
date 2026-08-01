import { describe, expect, it } from "vitest";

import { createServiceSuite, fabricService } from "../index.js";

describe("ServiceSuite", () => {
  describe("createServiceSuite", () => {
    it("should create a suite with name and version", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      expect(suite.name).toBe("test-suite");
      expect(suite.version).toBe("1.0.0");
    });

    it("should start with empty services and categories", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      expect(suite.services).toEqual([]);
      expect(suite.categories).toEqual([]);
    });
  });

  describe("register", () => {
    it("should register a service with a category", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "test-service",
        description: "A test service",
        input: {},
        service: () => "result",
      });

      suite.register(service, { category: "test-category" });

      expect(suite.services.length).toBe(1);
      expect(suite.services[0].name).toBe("test-service");
      expect(suite.services[0].category).toBe("test-category");
      expect(suite.categories).toContain("test-category");
    });

    it("should throw if service has no alias", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        input: {},
        service: () => "result",
      });

      expect(() =>
        suite.register(service, { category: "test-category" }),
      ).toThrow("Service must have an alias to be registered");
    });
  });

  describe("getServiceFunctions", () => {
    it("should return an empty array when no services are registered", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const functions = suite.getServiceFunctions();
      expect(functions).toEqual([]);
    });

    it("should return all registered service functions", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service1 = fabricService({
        alias: "service-1",
        service: () => "result-1",
      });
      const service2 = fabricService({
        alias: "service-2",
        service: () => "result-2",
      });

      suite.register(service1, { category: "category-a" });
      suite.register(service2, { category: "category-b" });

      const functions = suite.getServiceFunctions();
      expect(functions.length).toBe(2);
      expect(functions[0]).toBe(service1);
      expect(functions[1]).toBe(service2);
    });

    it("should return callable service functions", async () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "echo",
        input: {
          message: { type: String, required: true },
        },
        service: ({ message }: { message: string }) => `Echo: ${message}`,
      });

      suite.register(service, { category: "utils" });

      const functions = suite.getServiceFunctions();
      expect(functions.length).toBe(1);

      const result = await functions[0]({ message: "hello" });
      expect(result).toBe("Echo: hello");
    });
  });

  describe("getServiceFunction", () => {
    it("should return undefined for unknown service", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const func = suite.getServiceFunction("unknown");
      expect(func).toBeUndefined();
    });

    it("should return the service function by name", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "my-service",
        service: () => "result",
      });

      suite.register(service, { category: "category" });

      const func = suite.getServiceFunction("my-service");
      expect(func).toBe(service);
    });

    it("should return a callable function", async () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "adder",
        input: {
          a: { type: Number, required: true },
          b: { type: Number, required: true },
        },
        service: ({ a, b }: { a: number; b: number }) => a + b,
      });

      suite.register(service, { category: "math" });

      const func = suite.getServiceFunction("adder");
      expect(func).toBeDefined();

      const result = await func!({ a: 2, b: 3 });
      expect(result).toBe(5);
    });
  });

  describe("execute", () => {
    it("should execute a service by name", async () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "greeter",
        input: {
          name: { type: String, required: true },
        },
        service: ({ name }: { name: string }) => `Hello, ${name}!`,
      });

      suite.register(service, { category: "utils" });

      const result = await suite.execute("greeter", { name: "World" });
      expect(result).toBe("Hello, World!");
    });

    it("should throw for unknown service", async () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      await expect(suite.execute("unknown", {})).rejects.toThrow(
        'Service "unknown" not found',
      );
    });
  });

  describe("getService", () => {
    it("should return service metadata by name", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "test-service",
        description: "A test service",
        service: () => "result",
      });

      suite.register(service, { category: "category" });

      const meta = suite.getService("test-service");
      expect(meta).toBeDefined();
      expect(meta!.name).toBe("test-service");
      expect(meta!.description).toBe("A test service");
    });

    it("should return undefined for unknown service", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const meta = suite.getService("unknown");
      expect(meta).toBeUndefined();
    });
  });

  describe("getServicesByCategory", () => {
    it("should return services by category", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service1 = fabricService({
        alias: "service-a",
        service: () => "a",
      });
      const service2 = fabricService({
        alias: "service-b",
        service: () => "b",
      });
      const service3 = fabricService({
        alias: "service-c",
        service: () => "c",
      });

      suite.register(service1, { category: "math" });
      suite.register(service2, { category: "math" });
      suite.register(service3, { category: "utils" });

      const mathServices = suite.getServicesByCategory("math");
      expect(mathServices.length).toBe(2);
      expect(mathServices.map((s) => s.name)).toEqual([
        "service-a",
        "service-b",
      ]);

      const utilsServices = suite.getServicesByCategory("utils");
      expect(utilsServices.length).toBe(1);
      expect(utilsServices[0].name).toBe("service-c");
    });

    it("should return empty array for unknown category", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const services = suite.getServicesByCategory("unknown");
      expect(services).toEqual([]);
    });
  });

  describe("tags", () => {
    it("should default to an empty array when no tags are registered", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "service-a",
        service: () => "a",
      });

      suite.register(service, { category: "utils" });

      expect(suite.services[0].tags).toEqual([]);
      expect(suite.tags).toEqual([]);
    });

    it("should register tags alongside a category", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });
      const service = fabricService({
        alias: "service-a",
        service: () => "a",
      });

      suite.register(service, {
        category: "utils",
        tags: ["long", "privileged"],
      });

      expect(suite.getService("service-a")?.tags).toEqual([
        "long",
        "privileged",
      ]);
      expect(suite.services[0].category).toBe("utils");
    });

    it("should expose sorted unique tags across the suite", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
          tags: ["short", "public"],
        },
      );
      suite.register(
        fabricService({ alias: "service-b", service: () => "b" }),
        {
          category: "math",
          tags: ["short", "private"],
        },
      );

      expect(suite.tags).toEqual(["private", "public", "short"]);
    });

    it("should deduplicate tags on a single service", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
          tags: ["long", "long"],
        },
      );

      expect(suite.getService("service-a")?.tags).toEqual(["long"]);
    });
  });

  describe("getServicesByTag", () => {
    it("should return services carrying the tag across categories", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
          tags: ["immediate", "public"],
        },
      );
      suite.register(
        fabricService({ alias: "service-b", service: () => "b" }),
        {
          category: "math",
          tags: ["immediate", "privileged"],
        },
      );
      suite.register(
        fabricService({ alias: "service-c", service: () => "c" }),
        {
          category: "math",
          tags: ["long"],
        },
      );

      expect(suite.getServicesByTag("immediate").map((s) => s.name)).toEqual([
        "service-a",
        "service-b",
      ]);
      expect(suite.getServicesByTag("long").map((s) => s.name)).toEqual([
        "service-c",
      ]);
    });

    it("should return empty array for unknown tag", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
        },
      );

      expect(suite.getServicesByTag("unknown")).toEqual([]);
    });
  });

  describe("filterServices", () => {
    it("should return services matching a predicate", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
          tags: ["short", "public"],
        },
      );
      suite.register(
        fabricService({ alias: "service-b", service: () => "b" }),
        {
          category: "utils",
          tags: ["long", "public"],
        },
      );

      const mounted = suite.filterServices(
        (meta) => meta.tags.includes("public") && !meta.tags.includes("long"),
      );
      expect(mounted.map((s) => s.name)).toEqual(["service-a"]);
    });

    it("should return empty array when nothing matches", () => {
      const suite = createServiceSuite({
        name: "test-suite",
        version: "1.0.0",
      });

      suite.register(
        fabricService({ alias: "service-a", service: () => "a" }),
        {
          category: "utils",
        },
      );

      expect(suite.filterServices(() => false)).toEqual([]);
    });
  });
});
