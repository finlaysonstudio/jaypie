import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import createServer from "../createServer.js";

//
//
// Setup
//

vi.mock("@jaypie/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/logger")>();
  return {
    ...actual,
    log: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

let serverInstance: { close: () => void } | null = null;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
});

//
//
// Run tests
//

describe("CreateServer", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(createServer).toBeFunction();
    });

    it("Works with minimal configuration", async () => {
      const app = express();
      const { port, server } = await createServer(app, { port: 0 });

      serverInstance = server;

      expect(server).toBeDefined();
      expect(port).toBeNumber();
      expect(port).toBeGreaterThan(0);
    });
  });

  describe("Features", () => {
    it("Uses provided port", async () => {
      const app = express();
      const testPort = 9999;
      const { port, server } = await createServer(app, { port: testPort });

      serverInstance = server;

      expect(port).toBe(testPort);
    });

    it("Accepts port as string", async () => {
      const app = express();
      const { port, server } = await createServer(app, { port: "9998" });

      serverInstance = server;

      expect(port).toBe(9998);
    });

    it("Applies custom middleware", async () => {
      const app = express();
      const middlewareCalled = vi.fn();
      const testMiddleware = (
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) => {
        middlewareCalled();
        next();
      };

      const { server } = await createServer(app, {
        middleware: [testMiddleware],
        port: 0,
      });

      serverInstance = server;

      // Middleware is registered but not called until a request is made
      expect(middlewareCalled).not.toHaveBeenCalled();
    });

    it("Disables CORS when cors is false", async () => {
      const app = express();
      const { server } = await createServer(app, {
        cors: false,
        port: 0,
      });

      serverInstance = server;

      expect(server).toBeDefined();
    });

    it("Accepts custom JSON limit", async () => {
      const app = express();
      const { server } = await createServer(app, {
        jsonLimit: "10mb",
        port: 0,
      });

      serverInstance = server;

      expect(server).toBeDefined();
    });
  });

  describe("Error Cases", () => {
    it("Rejects when port is already in use", async () => {
      const app1 = express();
      const app2 = express();

      const { port, server: server1 } = await createServer(app1, { port: 0 });
      serverInstance = server1;

      // Try to bind to the same port - should reject with EADDRINUSE
      let secondServer: { close: () => void } | null = null;
      try {
        const result = await createServer(app2, { port });
        secondServer = result.server;
        // If we get here, close the server and fail the test
        secondServer.close();
        expect.fail("Expected createServer to reject with EADDRINUSE");
      } catch (error) {
        expect((error as { code?: string }).code).toBe("EADDRINUSE");
      } finally {
        if (secondServer) {
          secondServer.close();
        }
      }
    });
  });
});
