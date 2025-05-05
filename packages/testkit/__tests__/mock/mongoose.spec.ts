import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockConnection, mockModel } from "../../src/mock/mongoose";

describe("Mongoose Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mockConnection", () => {
    it("should have connect, disconnect and isConnected methods", () => {
      expect(typeof mockConnection.connect).toBe("function");
      expect(typeof mockConnection.disconnect).toBe("function");
      expect(typeof mockConnection.isConnected).toBe("function");
    });

    it("should track connect calls", async () => {
      await mockConnection.connect();
      expect(mockConnection.connect.mock.calls.length).toBe(1);
    });

    it("should track disconnect calls", async () => {
      await mockConnection.disconnect();
      expect(mockConnection.disconnect.mock.calls.length).toBe(1);
    });

    it("should return true for isConnected by default", () => {
      expect(mockConnection.isConnected()).toBe(true);
    });
  });

  describe("mockModel", () => {
    it("should create a model with expected properties and methods", () => {
      const schema = { fields: { name: String, age: Number } };
      const model = mockModel("User", schema);

      expect(model.modelName).toBe("User");
      expect(model.schema).toBe(schema);
      expect(typeof model.find).toBe("function");
      expect(typeof model.findOne).toBe("function");
      expect(typeof model.findById).toBe("function");
      expect(typeof model.create).toBe("function");
      expect(typeof model.updateOne).toBe("function");
      expect(typeof model.deleteOne).toBe("function");
    });

    it("should have find return empty array by default", () => {
      const model = mockModel("User", {});
      expect(model.find()).toEqual([]);
    });

    it("should have findOne return null by default", () => {
      const model = mockModel("User", {});
      expect(model.findOne()).toBeNull();
    });

    it("should have create return the input data", async () => {
      const model = mockModel("User", {});
      const userData = { name: "John", age: 30 };

      const result = await model.create(userData);

      expect(result).toBe(userData);
      expect(model.create.mock.calls.length).toBe(1);
      expect(model.create.mock.calls[0][0]).toBe(userData);
    });

    it("should have updateOne return modifiedCount 1 by default", async () => {
      const model = mockModel("User", {});
      const result = await model.updateOne();

      expect(result).toEqual({ modifiedCount: 1 });
    });

    it("should have deleteOne return deletedCount 1 by default", async () => {
      const model = mockModel("User", {});
      const result = await model.deleteOne();

      expect(result).toEqual({ deletedCount: 1 });
    });
  });
});
