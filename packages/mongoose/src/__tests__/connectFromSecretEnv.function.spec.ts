import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import connectFromSecretEnv from "../connectFromSecretEnv.function.js";

//
//
// Mock modules
//

vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");

  // Create skeleton of mock objects, as much as possible
  const mock = {
    connect: vi.fn(),
    connection: {
      close: vi.fn(),
      readyState: 1,
    },
    model: vi.fn(),
  };
  // Fill out nested mocks
  (mock.model as { findOne: unknown }).findOne = vi.fn();

  // Create something in the shape of the module
  const module = {
    ...(actual as object),
    default: {
      ...(actual as { default: object }).default,
      connect: mock.connect,
      connection: mock.connection,
      model: mock.model,
    },
  };

  // Have modules return correct objects
  mock.connect.mockResolvedValue("mock.connection");
  mock.model.mockReturnValue({
    findOne: (mock.model as { findOne: unknown }).findOne,
  });

  // Pin mocks to the module
  (module.default as { mock: typeof mock }).mock = mock;

  // return the module
  return module;
});

vi.mock("@jaypie/aws", async () => {
  const actual = await vi.importActual("@jaypie/aws");
  const module = {
    ...(actual as object),
    getSecret: vi.fn(() => "MOCK_MONGO_CONNECTION_URI"),
  };
  return module;
});

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  process.env.SECRET_MONGODB_URI = "MOCK_SECRET_MONGODB_URI";
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("ConnectFromSecretEnv Function", () => {
  it("Works", async () => {
    const response = await connectFromSecretEnv();
    expect(response).not.toBeUndefined();
  });
});
