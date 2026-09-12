import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { UnauthorizedError } from "@jaypie/errors";
import { createServiceSuite, fabricService } from "@jaypie/fabric";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mcpHttpHandler } from "../mcpHttpHandler.js";

//
//
// Fixtures
//

const API_KEY = "Bearer test-key";
const EVENT_STREAM = "text/event-stream";

function buildSuite() {
  const suite = createServiceSuite({ name: "test-suite", version: "1.2.3" });
  suite.register(
    fabricService({
      alias: "greet",
      input: { userName: { type: String } },
      service: ({ userName }) => `Hello, ${userName}!`,
    }),
    { category: "utils" },
  );
  suite.register(fabricService({ alias: "hidden", service: () => "hidden" }), {
    category: "utils",
  });
  return suite;
}

function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return { id, jsonrpc: "2.0", method, ...(params && { params }) };
}

let baseUrl: string;
let server: Server;

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<globalThis.Response> {
  return fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
}

beforeAll(async () => {
  const suite = buildSuite();
  const app = express();
  app.use(express.json());
  app.all("/mcp", mcpHttpHandler({ services: ["greet"], suite }));
  app.all("/docs", mcpHttpHandler({ services: ["version"] }));
  app.all(
    "/gated",
    mcpHttpHandler({
      setup: (req) => {
        if (req.headers.authorization !== API_KEY) {
          throw new UnauthorizedError();
        }
      },
      suite,
    }),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

//
//
// Tests
//

describe("mcpHttpHandler", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(mcpHttpHandler).toBeInstanceOf(Function);
    });

    it("works with no options", () => {
      expect(mcpHttpHandler()).toBeInstanceOf(Function);
    });
  });

  describe("Happy Paths", () => {
    it("initializes", async () => {
      const response = await post("/mcp", rpc("initialize"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.result.serverInfo).toEqual({
        name: "test-suite",
        version: "1.2.3",
      });
      expect(body.result.capabilities.tools).toEqual({});
    });

    it("lists only allowlisted tools", async () => {
      const response = await post("/mcp", rpc("tools/list"));
      const body = await response.json();
      expect(
        body.result.tools.map((tool: { name: string }) => tool.name),
      ).toEqual(["greet"]);
      expect(body.result.tools[0].inputSchema.type).toBe("object");
    });

    it("calls a tool", async () => {
      const response = await post(
        "/mcp",
        rpc("tools/call", { arguments: { userName: "Ada" }, name: "greet" }),
      );
      const body = await response.json();
      expect(body.result.content).toEqual([
        { text: "Hello, Ada!", type: "text" },
      ]);
    });
  });

  describe("Features", () => {
    it("answers a notification with 202 and no body", async () => {
      const response = await post("/mcp", {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
    });

    it("answers a batch as an array", async () => {
      const response = await post("/mcp", [
        rpc("ping", undefined, 1),
        rpc("ping", undefined, 2),
      ]);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });

    it("streams server-sent events when the client prefers them", async () => {
      const response = await post("/mcp", rpc("ping"), {
        accept: EVENT_STREAM,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(EVENT_STREAM);
      const text = await response.text();
      expect(text).toContain("event: message\n");
      const data = text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);
      expect(JSON.parse(String(data))).toEqual({
        id: 1,
        jsonrpc: "2.0",
        result: {},
      });
    });

    it("streams one event per batch response", async () => {
      const response = await post(
        "/mcp",
        [rpc("ping", undefined, 1), rpc("ping", undefined, 2)],
        { accept: EVENT_STREAM },
      );
      const text = await response.text();
      expect(text.match(/event: message/g)).toHaveLength(2);
    });

    it("answers JSON when the client lists JSON first", async () => {
      const response = await post("/mcp", rpc("ping"), {
        accept: `application/json, ${EVENT_STREAM}`,
      });
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("answers a streamed notification with 202", async () => {
      const response = await post(
        "/mcp",
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { accept: EVENT_STREAM },
      );
      expect(response.status).toBe(202);
    });

    it("serves the Jaypie suite by default", async () => {
      const response = await post("/docs", rpc("tools/list"));
      const body = await response.json();
      expect(
        body.result.tools.map((tool: { name: string }) => tool.name),
      ).toEqual(["version"]);
    });

    it("runs lifecycle setup before answering", async () => {
      const response = await post("/gated", rpc("ping"), {
        authorization: API_KEY,
      });
      expect(response.status).toBe(200);
    });
  });

  describe("Sad Paths", () => {
    it("answers GET with 405", async () => {
      const response = await fetch(`${baseUrl}/mcp`);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    });

    it("answers DELETE with 405", async () => {
      const response = await fetch(`${baseUrl}/mcp`, { method: "DELETE" });
      expect(response.status).toBe(405);
    });

    it("refuses a tool outside the allowlist", async () => {
      const response = await post(
        "/mcp",
        rpc("tools/call", { name: "hidden" }),
      );
      const body = await response.json();
      expect(body.error.code).toBe(-32602);
    });

    it("refuses a request that fails setup", async () => {
      const response = await post("/gated", rpc("ping"));
      expect(response.status).toBe(401);
    });
  });
});
