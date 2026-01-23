import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fabricService } from "../service.js";

// Subject
import { fabricWebSocket } from "../websocket/index.js";
import type { WebSocketServiceContext } from "../websocket/index.js";

//
//
// Mock modules
//

vi.mock("@jaypie/lambda", () => ({
  websocketHandler: vi.fn((handler, options) => {
    // Return a function that can be called with event/context
    const wrapped = async (event: unknown, lambdaContext: unknown) => {
      // Create a mock WebSocket context
      const wsContext = {
        awsRequestId: (lambdaContext as Record<string, string>)?.awsRequestId,
        body: (event as Record<string, string | null>)?.body,
        broadcast: vi.fn().mockResolvedValue({
          staleConnections: [],
          successCount: 0,
        }),
        connectionId: "test-connection-id",
        domainName: "ws.example.com",
        queryStringParameters: (event as Record<string, unknown>)
          ?.queryStringParameters as Record<string, string>,
        routeKey: (event as Record<string, unknown>)?.requestContext
          ? (
              (event as Record<string, unknown>).requestContext as Record<
                string,
                string
              >
            ).routeKey
          : "$default",
        send: vi
          .fn()
          .mockResolvedValue({ connectionValid: true, success: true }),
        stage: "production",
      };
      return handler(event, wsContext);
    };
    wrapped._options = options;
    return wrapped;
  }),
}));

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  vi.clearAllMocks();
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Helper functions
//

function createWebSocketEvent(
  routeKey: string,
  body?: string,
  queryStringParameters?: Record<string, string>,
) {
  return {
    body,
    queryStringParameters,
    requestContext: {
      connectionId: "test-connection-id",
      domainName: "ws.example.com",
      routeKey,
      stage: "production",
    },
  };
}

//
//
// Run tests
//

describe("fabricWebSocket", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(fabricWebSocket).toBeDefined();
      expect(fabricWebSocket).toBeFunction();
    });

    it("Returns a function", () => {
      const service = fabricService({
        service: () => "test",
      });
      const handler = fabricWebSocket(service);
      expect(handler).toBeFunction();
    });
  });

  describe("Service Styles", () => {
    it("Accepts a pre-instantiated service", async () => {
      const service = fabricService({
        alias: "test-service",
        service: () => "result",
      });
      const handler = fabricWebSocket(service);
      const event = createWebSocketEvent("$default", '{"action":"test"}');
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
    });

    it("Accepts an inline function", async () => {
      const handler = fabricWebSocket(() => "result");
      const event = createWebSocketEvent("$default", '{"action":"test"}');
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
    });

    it("Accepts a config object", async () => {
      const handler = fabricWebSocket({
        alias: "test-service",
        service: () => "result",
      });
      const event = createWebSocketEvent("$default", '{"action":"test"}');
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
    });
  });

  describe("Route Handling", () => {
    it("Handles $connect events", async () => {
      const onConnect = vi.fn();
      const handler = fabricWebSocket({
        onConnect,
        service: () => "result",
      });
      const event = createWebSocketEvent("$connect", undefined, {
        token: "abc123",
      });
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
      expect(onConnect).toHaveBeenCalled();
    });

    it("Returns 401 if onConnect throws", async () => {
      const onConnect = vi.fn().mockRejectedValue(new Error("Unauthorized"));
      const handler = fabricWebSocket({
        onConnect,
        service: () => "result",
      });
      const event = createWebSocketEvent("$connect");
      const result = await handler(event, {});
      expect(result.statusCode).toBe(401);
    });

    it("Handles $disconnect events", async () => {
      const onDisconnect = vi.fn();
      const handler = fabricWebSocket({
        onDisconnect,
        service: () => "result",
      });
      const event = createWebSocketEvent("$disconnect");
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
      expect(onDisconnect).toHaveBeenCalled();
    });

    it("Handles $default events", async () => {
      const service = vi.fn().mockReturnValue({ received: true });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent("$default", '{"message":"hello"}');
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
      expect(service).toHaveBeenCalled();
    });

    it("Handles custom routes", async () => {
      const service = vi.fn().mockReturnValue({ sent: true });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent("sendMessage", '{"to":"user1"}');
      const result = await handler(event, {});
      expect(result.statusCode).toBe(200);
      expect(service).toHaveBeenCalled();
    });
  });

  describe("Input Parsing", () => {
    it("Parses JSON body as service input", async () => {
      let receivedInput: unknown;
      const service = vi.fn((input) => {
        receivedInput = input;
        return { received: true };
      });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent(
        "$default",
        '{"action":"test","value":42}',
      );
      await handler(event, {});
      expect(receivedInput).toEqual({ action: "test", value: 42 });
    });

    it("Handles non-JSON body", async () => {
      let receivedInput: unknown;
      const service = vi.fn((input) => {
        receivedInput = input;
        return { received: true };
      });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent("$default", "plain text message");
      await handler(event, {});
      expect(receivedInput).toEqual({ body: "plain text message" });
    });

    it("Handles empty body", async () => {
      let receivedInput: unknown;
      const service = vi.fn((input) => {
        receivedInput = input;
        return { received: true };
      });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent("$default");
      await handler(event, {});
      expect(receivedInput).toEqual({});
    });
  });

  describe("Context", () => {
    it("Provides WebSocket context to service", async () => {
      let receivedContext: WebSocketServiceContext | undefined;
      const service = vi.fn((_input, context) => {
        receivedContext = context as WebSocketServiceContext;
        return { received: true };
      });
      const handler = fabricWebSocket({ service });
      const event = createWebSocketEvent("$default", '{"test":true}');
      await handler(event, {});
      expect(receivedContext?.connectionId).toBe("test-connection-id");
      expect(receivedContext?.domainName).toBe("ws.example.com");
      expect(receivedContext?.stage).toBe("production");
      expect(receivedContext?.routeKey).toBe("$default");
      expect(receivedContext?.send).toBeFunction();
      expect(receivedContext?.broadcast).toBeFunction();
    });

    it("Provides query string parameters in context", async () => {
      let receivedContext: WebSocketServiceContext | undefined;
      const handler = fabricWebSocket({
        onConnect: (context) => {
          receivedContext = context as unknown as WebSocketServiceContext;
        },
        service: () => "result",
      });
      const event = createWebSocketEvent("$connect", undefined, {
        token: "abc123",
      });
      await handler(event, {});
      expect(receivedContext?.queryStringParameters).toEqual({
        token: "abc123",
      });
    });
  });

  describe("Callbacks", () => {
    it("Calls onComplete on success", async () => {
      const onComplete = vi.fn();
      const handler = fabricWebSocket({
        onComplete,
        service: () => ({ result: "success" }),
      });
      const event = createWebSocketEvent("$default", '{"test":true}');
      await handler(event, {});
      expect(onComplete).toHaveBeenCalledWith({ result: "success" });
    });

    it("Calls onMessage when service sends messages", async () => {
      const onMessage = vi.fn();
      const service = vi.fn((_input, context: WebSocketServiceContext) => {
        if (context.sendMessage) {
          context.sendMessage({ content: "Processing...", level: "info" });
        }
        return { result: "done" };
      });
      const handler = fabricWebSocket({
        onMessage,
        service,
      });
      const event = createWebSocketEvent("$default", '{"test":true}');
      await handler(event, {});
      expect(onMessage).toHaveBeenCalledWith({
        content: "Processing...",
        level: "info",
      });
    });
  });

  describe("Handler Options", () => {
    it("Passes options to websocketHandler", () => {
      const handler = fabricWebSocket({
        name: "test-handler",
        secrets: ["MY_SECRET"],
        service: () => "result",
      });
      // Check that options were passed
      expect((handler as unknown as { _options: unknown })._options).toEqual(
        expect.objectContaining({
          name: "test-handler",
          secrets: ["MY_SECRET"],
        }),
      );
    });
  });
});
