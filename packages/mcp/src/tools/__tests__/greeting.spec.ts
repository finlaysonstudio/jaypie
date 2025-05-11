import { describe, it, expect } from "vitest";
import { createGreetingTool } from "../../index";

describe("Greeting Tool", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is an object with the expected shape", () => {
      const greetingTool = createGreetingTool();
      expect(greetingTool).toHaveProperty("name", "greeting");
      expect(greetingTool).toHaveProperty("description");
      expect(greetingTool).toHaveProperty("parameters");
      expect(greetingTool).toHaveProperty("handler");
      expect(typeof greetingTool.handler).toBe("function");
    });
    
    it("returns a string", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({});
      expect(typeof result).toBe("string");
    });
  });
  
  // Error Conditions
  describe("Error Conditions", () => {
    it("handles non-string salutation", async () => {
      const greetingTool = createGreetingTool();
      // @ts-expect-error Testing invalid input
      const result = await greetingTool.handler({ salutation: 123 });
      // Should coerce to string or use default
      expect(typeof result).toBe("string");
    });

    it("handles non-string name", async () => {
      const greetingTool = createGreetingTool();
      // @ts-expect-error Testing invalid input
      const result = await greetingTool.handler({ name: 456 });
      // Should coerce to string or use default
      expect(typeof result).toBe("string");
    });
  });
  
  // Happy Paths
  describe("Happy Paths", () => {
    it("returns 'Hello, World!' with default parameters", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({});
      expect(result).toBe("Hello, World!");
    });
    
    it("returns custom greeting with provided parameters", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({ 
        salutation: "Ahoy", 
        name: "Captain" 
      });
      expect(result).toBe("Ahoy, Captain!");
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("handles empty strings", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({ 
        salutation: "", 
        name: "" 
      });
      expect(result).toBe(", !");
    });

    it("handles special characters", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({ 
        salutation: "¡Hola", 
        name: "Señor" 
      });
      expect(result).toBe("¡Hola, Señor!");
    });
  });
});