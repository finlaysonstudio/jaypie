import { describe, expect, it, vi } from "vitest";

vi.mock("@jaypie/dynamodb", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    initClient: vi.fn(),
    queryByAlias: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@jaypie/mcp", () => ({
  createMcpServer: vi.fn(() => ({
    connect: vi.fn(),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: vi.fn(() => ({
    handleRequest: vi.fn(),
  })),
}));

import { createMcpHandler, mcpAuthMiddleware } from "../mcp.route.js";

//
//
// Tests
//

describe("mcp.route", () => {
  describe("createMcpHandler", () => {
    it("is a function", () => {
      expect(typeof createMcpHandler).toBe("function");
    });

    it("returns a handler function", async () => {
      const handler = await createMcpHandler();
      expect(typeof handler).toBe("function");
    });
  });

  describe("mcpAuthMiddleware", () => {
    it("is a function", () => {
      expect(typeof mcpAuthMiddleware).toBe("function");
    });

    it("returns 401 when no authorization header", async () => {
      const req = { headers: {} } as never;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as never;
      const next = vi.fn();

      await mcpAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
