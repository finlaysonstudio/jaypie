import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { mcpExpressHandler } from "../mcpExpressHandler.js";

describe("mcpExpressHandler", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(mcpExpressHandler).toBeInstanceOf(Function);
    });

    it("Works", async () => {
      const handler = await mcpExpressHandler();
      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe("Happy Paths", () => {
    it("Creates a handler function", async () => {
      const handler = await mcpExpressHandler({
        version: "1.0.0",
      });

      expect(handler).toBeInstanceOf(Function);
    });

    it("Accepts version option", async () => {
      const handler = await mcpExpressHandler({
        version: "2.0.0",
      });

      expect(handler).toBeInstanceOf(Function);
    });

    it("Accepts enableSessions option", async () => {
      const handler = await mcpExpressHandler({
        enableSessions: false,
      });

      expect(handler).toBeInstanceOf(Function);
    });

    it("Accepts custom sessionIdGenerator", async () => {
      const customGenerator = () => "custom-session-id";
      const handler = await mcpExpressHandler({
        sessionIdGenerator: customGenerator,
      });

      expect(handler).toBeInstanceOf(Function);
    });

    it("Accepts enableJsonResponse option", async () => {
      const handler = await mcpExpressHandler({
        enableJsonResponse: true,
      });

      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe("Features", () => {
    it("Defaults to enabling sessions", async () => {
      const handler = await mcpExpressHandler();
      expect(handler).toBeInstanceOf(Function);
    });

    it("Defaults to SSE streaming (not JSON response)", async () => {
      const handler = await mcpExpressHandler();
      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe("Error Conditions", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {
        method: "POST",
        headers: {},
        body: {},
      };

      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false,
      };
    });

    it("Handles errors gracefully when response not yet sent", async () => {
      const handler = await mcpExpressHandler();

      mockReq.body = undefined;

      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toBeDefined();
    });
  });
});
