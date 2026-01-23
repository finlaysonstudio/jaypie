import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@jaypie/errors";
import { HTTP, jaypieHandler } from "@jaypie/kit";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";

// Subject
import websocketHandler from "../websocketHandler.js";
import type { WebSocketEvent, WebSocketContext } from "../websocketHandler.js";

//
//
// Mock constants
//

const MOCK_CONNECTION_ID = "ABC123==";
const MOCK_DOMAIN_NAME = "ws.example.com";
const MOCK_STAGE = "production";

//
//
// Mock modules
//

vi.mock("@jaypie/kit", async () => {
  const actual = await vi.importActual("@jaypie/kit");
  const module = {
    ...actual,
    jaypieHandler: vi.fn(
      (
        handler: (...args: unknown[]) => unknown,
        options: Record<string, unknown>,
      ) => {
        return (
          actual as { jaypieHandler: typeof jaypieHandler }
        ).jaypieHandler(handler, options);
      },
    ),
  };
  return module;
});

vi.mock("@jaypie/aws", async () => {
  const actual = await vi.importActual("@jaypie/aws");
  return {
    ...actual,
    broadcastToConnections: vi.fn().mockResolvedValue({
      results: new Map(),
      staleConnections: [],
      successCount: 0,
    }),
    sendToConnection: vi.fn().mockResolvedValue({
      connectionValid: true,
      success: true,
    }),
  };
});

//
//
// Helper Functions
//

function createMockWebSocketEvent(
  overrides: Partial<WebSocketEvent> = {},
): WebSocketEvent {
  return {
    body: null,
    headers: {},
    isBase64Encoded: false,
    queryStringParameters: null,
    requestContext: {
      connectionId: MOCK_CONNECTION_ID,
      domainName: MOCK_DOMAIN_NAME,
      eventType: "MESSAGE",
      routeKey: "$default",
      stage: MOCK_STAGE,
    },
    ...overrides,
  };
}

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
  restoreLog(log);
});

//
//
// Run tests
//

describe("WebSocket Handler Module", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(websocketHandler).toBeDefined();
      expect(websocketHandler).toBeFunction();
    });
  });

  describe("Error Conditions", () => {
    it("Throws if not passed a function", () => {
      expect(() =>
        websocketHandler(undefined as unknown as () => void),
      ).toThrow();
      expect(() => websocketHandler(42 as unknown as () => void)).toThrow();
      expect(() =>
        websocketHandler("string" as unknown as () => void),
      ).toThrow();
      expect(() => websocketHandler({} as unknown as () => void)).toThrow();
      expect(() => websocketHandler([] as unknown as () => void)).toThrow();
      expect(() => websocketHandler(null as unknown as () => void)).toThrow();
    });

    it("Returns a jaypie error if function throws", async () => {
      const mockFunction = vi.fn();
      mockFunction.mockRejectedValue(new Error("This error should be caught"));
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      const result = (await handler(event, {})) as { statusCode: number };
      expect(result.statusCode).toBe(500);
    });

    it("Returns an error if a lifecycle function throws", async () => {
      const mockFunction = vi.fn();
      const handler = websocketHandler(mockFunction, {
        validate: [
          async () => {
            throw new Error("Sorpresa!");
          },
        ],
      });
      const event = createMockWebSocketEvent();
      const result = (await handler(event, {})) as { statusCode: number };
      expect(result.statusCode).toBe(HTTP.CODE.INTERNAL_ERROR);
    });

    it("Returns unavailable if unavailable option is set", async () => {
      const mockFunction = vi.fn();
      const handler = websocketHandler(mockFunction, {
        unavailable: true,
      });
      const event = createMockWebSocketEvent();
      const result = (await handler(event, {})) as {
        body: string;
        statusCode: number;
      };
      expect(result.statusCode).toBe(HTTP.CODE.UNAVAILABLE);
    });
  });

  describe("Parameter Order", () => {
    it("Accepts handler as first parameter and options as second parameter", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const options = { name: "test" };
      const handler = websocketHandler(mockFunction, options);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it("Swaps parameters if handler is an object and options is a function", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const options = { name: "test" };
      const handler = websocketHandler(options, mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(jaypieHandler).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining(options),
      );
    });

    it("Throws if not passed a function after parameter swap", () => {
      const options = { name: "test" };
      expect(() =>
        websocketHandler(options, {} as unknown as () => void),
      ).toThrow(ConfigurationError);
    });
  });

  describe("WebSocket Context", () => {
    it("Provides routeKey in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        requestContext: {
          connectionId: MOCK_CONNECTION_ID,
          domainName: MOCK_DOMAIN_NAME,
          routeKey: "$connect",
          stage: MOCK_STAGE,
        },
      });
      await handler(event, {});
      expect(receivedContext?.routeKey).toBe("$connect");
    });

    it("Provides connectionId in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(receivedContext?.connectionId).toBe(MOCK_CONNECTION_ID);
    });

    it("Provides domainName in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(receivedContext?.domainName).toBe(MOCK_DOMAIN_NAME);
    });

    it("Provides stage in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(receivedContext?.stage).toBe(MOCK_STAGE);
    });

    it("Provides body in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        body: '{"action":"test"}',
      });
      await handler(event, {});
      expect(receivedContext?.body).toBe('{"action":"test"}');
    });

    it("Provides queryStringParameters in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        queryStringParameters: { token: "abc123" },
      });
      await handler(event, {});
      expect(receivedContext?.queryStringParameters).toEqual({
        token: "abc123",
      });
    });

    it("Provides send function in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(receivedContext?.send).toBeFunction();
    });

    it("Provides broadcast function in context", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(receivedContext?.broadcast).toBeFunction();
    });
  });

  describe("Route Keys", () => {
    it("Handles $connect route", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        requestContext: {
          connectionId: MOCK_CONNECTION_ID,
          domainName: MOCK_DOMAIN_NAME,
          eventType: "CONNECT",
          routeKey: "$connect",
          stage: MOCK_STAGE,
        },
      });
      await handler(event, {});
      expect(receivedContext?.routeKey).toBe("$connect");
    });

    it("Handles $disconnect route", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        requestContext: {
          connectionId: MOCK_CONNECTION_ID,
          domainName: MOCK_DOMAIN_NAME,
          eventType: "DISCONNECT",
          routeKey: "$disconnect",
          stage: MOCK_STAGE,
        },
      });
      await handler(event, {});
      expect(receivedContext?.routeKey).toBe("$disconnect");
    });

    it("Handles custom routes", async () => {
      let receivedContext: WebSocketContext | undefined;
      const mockFunction = vi.fn((_event, context) => {
        receivedContext = context;
        return { statusCode: 200 };
      });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent({
        requestContext: {
          connectionId: MOCK_CONNECTION_ID,
          domainName: MOCK_DOMAIN_NAME,
          routeKey: "sendMessage",
          stage: MOCK_STAGE,
        },
      });
      await handler(event, {});
      expect(receivedContext?.routeKey).toBe("sendMessage");
    });
  });

  describe("Observability", () => {
    it("Does not log above trace", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
      expect(log.fatal).not.toHaveBeenCalled();
    });

    it("Includes the invoke in the log", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, { awsRequestId: "MOCK_AWS_REQUEST_ID" });
      expect(log.tag).toHaveBeenCalled();
      expect(log.tag).toHaveBeenCalledWith({
        invoke: "MOCK_AWS_REQUEST_ID",
      });
    });

    it("Tags with connectionId and routeKey", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(log.tag).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: expect.any(String),
        }),
      );
      expect(log.tag).toHaveBeenCalledWith(
        expect.objectContaining({
          routeKey: "$default",
        }),
      );
    });
  });

  describe("Happy Paths", () => {
    it("Calls a function I pass it", async () => {
      const mockFunction = vi.fn().mockReturnValue({ statusCode: 200 });
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it("Awaits a function I pass it", async () => {
      const mockFunction = vi.fn(async () => ({ statusCode: 200 }));
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      await handler(event, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it("Returns what the function returns", async () => {
      const mockFunction = vi.fn(() => ({ statusCode: 200, body: "OK" }));
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      const result = await handler(event, {});
      expect(result).toEqual({ statusCode: 200, body: "OK" });
    });

    it("Returns what async functions resolve", async () => {
      const mockFunction = vi.fn(async () => ({ statusCode: 200, body: "OK" }));
      const handler = websocketHandler(mockFunction);
      const event = createMockWebSocketEvent();
      const result = await handler(event, {});
      expect(result).toEqual({ statusCode: 200, body: "OK" });
    });

    describe("Features", () => {
      it("Provides a logger with handler and layer", async () => {
        const mockFunction = vi.fn(() => {
          log.warn("Alert level zero");
          return { statusCode: 200 };
        });
        const handler = websocketHandler(mockFunction);
        const event = createMockWebSocketEvent();
        expect(log.warn).not.toHaveBeenCalled();
        await handler(event, {});
        expect(log.warn).toHaveBeenCalledTimes(1);
      });

      it("Does not allocate resources until function is called", async () => {
        const mockFunction = vi.fn();
        websocketHandler(mockFunction);
        websocketHandler(mockFunction);
        expect(jaypieHandler).not.toHaveBeenCalled();
      });

      it("Throws errors when throw option is true", async () => {
        const mockFunction = vi.fn(() => {
          throw new Error();
        });
        const handler = websocketHandler(mockFunction, { throw: true });
        const event = createMockWebSocketEvent();
        await expect(handler(event, {})).rejects.toThrow();
        expect(log.debug).toHaveBeenCalled();
      });
    });
  });
});
