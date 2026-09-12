import { BadRequestError } from "@jaypie/errors";
import { createServiceSuite, fabricService } from "@jaypie/fabric";
import { describe, expect, it } from "vitest";

import {
  expectsResponse,
  handleMcpRpc,
  handleMcpRpcBody,
  JSON_RPC_ERROR,
  MCP_PROTOCOL_VERSION,
  parseRpcBody,
} from "../rpc.js";
import { findTool, selectTools } from "../tools.js";

//
//
// Fixtures
//

function buildSuite() {
  const suite = createServiceSuite({ name: "test-suite", version: "1.2.3" });
  suite.register(
    fabricService({
      alias: "greet",
      description: "Greet someone",
      input: {
        loud: { default: false, type: Boolean },
        mode: { required: false, type: ["formal", "casual"] },
        userName: { description: "Who to greet", type: String },
      },
      service: ({ loud, userName }) => {
        const greeting = `Hello, ${userName}!`;
        return loud ? greeting.toUpperCase() : greeting;
      },
    }),
    { category: "utils" },
  );
  suite.register(
    fabricService({ alias: "info", service: () => ({ ok: true }) }),
    { category: "utils" },
  );
  suite.register(
    fabricService({ alias: "nothing", service: () => undefined }),
    { category: "utils" },
  );
  suite.register(
    fabricService({
      alias: "reject",
      service: (): string => {
        throw new BadRequestError("Nope");
      },
    }),
    { category: "utils" },
  );
  suite.register(
    fabricService({
      alias: "crash",
      service: (): string => {
        // Deliberately not a Jaypie error to exercise the unhandled path
        throw new TypeError("Secret internals");
      },
    }),
    { category: "utils" },
  );
  return suite;
}

function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return { id, jsonrpc: "2.0", method, ...(params && { params }) };
}

//
//
// Tests
//

describe("MCP JSON-RPC", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(handleMcpRpc).toBeInstanceOf(Function);
      expect(handleMcpRpcBody).toBeInstanceOf(Function);
    });

    it("answers ping", async () => {
      const suite = buildSuite();
      expect(await handleMcpRpc(rpc("ping"), { suite })).toEqual({
        id: 1,
        jsonrpc: "2.0",
        result: {},
      });
    });
  });

  describe("Happy Paths", () => {
    it("initializes with suite name and version", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(rpc("initialize"), { suite });
      expect(response?.result).toEqual({
        capabilities: { tools: {} },
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: "test-suite", version: "1.2.3" },
      });
    });

    it("lists tools with JSON Schema inputs", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(rpc("tools/list"), { suite });
      const { tools } = response?.result as {
        tools: {
          description: string;
          inputSchema: Record<string, unknown>;
          name: string;
        }[];
      };
      expect(tools.map((tool) => tool.name)).toEqual([
        "greet",
        "info",
        "nothing",
        "reject",
        "crash",
      ]);
      expect(tools[0].description).toBe("Greet someone");
      expect(tools[0].inputSchema).toEqual({
        properties: {
          loud: { type: "boolean" },
          mode: { enum: ["formal", "casual"], type: "string" },
          userName: { description: "Who to greet", type: "string" },
        },
        required: ["userName"],
        type: "object",
      });
    });

    it("calls a tool", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { arguments: { userName: "Ada" }, name: "greet" }),
        { suite },
      );
      expect(response?.result).toEqual({
        content: [{ text: "Hello, Ada!", type: "text" }],
      });
    });

    it("answers a batch as an array", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpcBody(
        [rpc("ping", undefined, 1), rpc("ping", undefined, 2)],
        { suite },
      );
      expect(Array.isArray(response)).toBe(true);
      expect((response as unknown[]).length).toBe(2);
    });
  });

  describe("Features", () => {
    it("narrows tools to the services allowlist", async () => {
      const suite = buildSuite();
      const options = { services: ["info", "greet"], suite };
      const list = await handleMcpRpc(rpc("tools/list"), options);
      const { tools } = list?.result as { tools: { name: string }[] };
      expect(tools.map((tool) => tool.name)).toEqual(["greet", "info"]);

      const call = await handleMcpRpc(
        rpc("tools/call", { name: "nothing" }),
        options,
      );
      expect(call?.error?.code).toBe(JSON_RPC_ERROR.INVALID_PARAMS);
    });

    it("shares selection logic between list and call", () => {
      const suite = buildSuite();
      expect(
        selectTools({ services: ["info"], suite }).map((tool) => tool.alias),
      ).toEqual(["info"]);
      expect(findTool("greet", { services: ["info"], suite })).toBeUndefined();
      expect(findTool("info", { suite })?.alias).toBe("info");
    });

    it("overrides name and version", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(rpc("initialize"), {
        name: "custom",
        suite,
        version: "9.9.9",
      });
      expect((response?.result as { serverInfo: unknown }).serverInfo).toEqual({
        name: "custom",
        version: "9.9.9",
      });
    });

    it("echoes a supported protocol version", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("initialize", { protocolVersion: "2025-03-26" }),
        { suite },
      );
      expect(
        (response?.result as { protocolVersion: string }).protocolVersion,
      ).toBe("2025-03-26");
    });

    it("answers the latest protocol version for an unknown one", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("initialize", { protocolVersion: "1999-01-01" }),
        { suite },
      );
      expect(
        (response?.result as { protocolVersion: string }).protocolVersion,
      ).toBe(MCP_PROTOCOL_VERSION);
    });

    it("formats object results as JSON text", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(rpc("tools/call", { name: "info" }), {
        suite,
      });
      expect(response?.result).toEqual({
        content: [
          { text: JSON.stringify({ ok: true }, null, 2), type: "text" },
        ],
      });
    });

    it("formats an empty result as empty text", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { name: "nothing" }),
        { suite },
      );
      expect(response?.result).toEqual({
        content: [{ text: "", type: "text" }],
      });
    });

    it("returns null for notifications", async () => {
      const suite = buildSuite();
      expect(
        await handleMcpRpc(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { suite },
        ),
      ).toBeNull();
      expect(
        await handleMcpRpc(
          { jsonrpc: "2.0", method: "notifications/unknown" },
          { suite },
        ),
      ).toBeNull();
    });

    it("returns null for a batch of notifications", async () => {
      const suite = buildSuite();
      expect(
        await handleMcpRpcBody(
          [
            { jsonrpc: "2.0", method: "notifications/initialized" },
            { jsonrpc: "2.0", method: "notifications/cancelled" },
          ],
          { suite },
        ),
      ).toBeNull();
    });

    it("parses string and Buffer bodies", async () => {
      const suite = buildSuite();
      const text = JSON.stringify(rpc("ping"));
      expect(await handleMcpRpcBody(text, { suite })).toMatchObject({
        result: {},
      });
      expect(
        await handleMcpRpcBody(Buffer.from(text), { suite }),
      ).toMatchObject({ result: {} });
    });

    it("serves the Jaypie suite by default", async () => {
      const response = await handleMcpRpc(rpc("tools/list"), {
        services: ["version"],
      });
      const { tools } = response?.result as { tools: { name: string }[] };
      expect(tools.map((tool) => tool.name)).toEqual(["version"]);
    });

    describe("expectsResponse", () => {
      it("is false for notifications", () => {
        expect(expectsResponse({ jsonrpc: "2.0", method: "x" })).toBe(false);
        expect(expectsResponse([{ jsonrpc: "2.0", method: "x" }])).toBe(false);
      });

      it("is true for requests, mixed batches, and malformed bodies", () => {
        expect(expectsResponse(rpc("ping"))).toBe(true);
        expect(
          expectsResponse([{ jsonrpc: "2.0", method: "x" }, rpc("ping")]),
        ).toBe(true);
        expect(expectsResponse([])).toBe(true);
        expect(expectsResponse("not json")).toBe(true);
        expect(expectsResponse(undefined)).toBe(true);
      });
    });

    describe("parseRpcBody", () => {
      it("returns undefined for unparseable text", () => {
        expect(parseRpcBody("not json")).toBeUndefined();
      });

      it("passes parsed bodies through", () => {
        const body = rpc("ping");
        expect(parseRpcBody(body)).toBe(body);
      });
    });
  });

  describe("Sad Paths", () => {
    it("reports an unknown method", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(rpc("nope"), { suite });
      expect(response?.error?.code).toBe(JSON_RPC_ERROR.METHOD_NOT_FOUND);
    });

    it("reports a request carrying no method", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc({ id: 9, jsonrpc: "2.0" }, { suite });
      expect(response).toMatchObject({
        error: { code: JSON_RPC_ERROR.INVALID_REQUEST },
        id: 9,
      });
    });

    it("reports an unknown tool", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { name: "missing" }),
        { suite },
      );
      expect(response?.error?.code).toBe(JSON_RPC_ERROR.INVALID_PARAMS);
    });

    it("reports arguments that are not an object", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { arguments: ["Ada"], name: "greet" }),
        { suite },
      );
      expect(response?.error?.code).toBe(JSON_RPC_ERROR.INVALID_PARAMS);
    });

    it("surfaces a Jaypie error message as a tool error", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { name: "reject" }),
        { suite },
      );
      expect(response?.result).toEqual({
        content: [{ text: "Nope", type: "text" }],
        isError: true,
      });
    });

    it("hides an unhandled error message", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { name: "crash" }),
        { suite },
      );
      expect(response?.result).toEqual({
        content: [{ text: "The tool call failed", type: "text" }],
        isError: true,
      });
    });

    it("reports a missing required input as a tool error", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpc(
        rpc("tools/call", { arguments: {}, name: "greet" }),
        { suite },
      );
      expect((response?.result as { isError: boolean }).isError).toBe(true);
    });

    it("reports an empty batch", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpcBody([], { suite });
      expect(response).toMatchObject({
        error: { code: JSON_RPC_ERROR.INVALID_REQUEST },
      });
    });

    it("reports a batch entry that is not an object", async () => {
      const suite = buildSuite();
      const response = await handleMcpRpcBody([5, rpc("ping")], { suite });
      expect(response).toEqual([
        expect.objectContaining({
          error: expect.objectContaining({
            code: JSON_RPC_ERROR.INVALID_REQUEST,
          }),
        }),
        expect.objectContaining({ result: {} }),
      ]);
    });

    it("reports a body that is not JSON", async () => {
      expect(await handleMcpRpcBody("not an object")).toMatchObject({
        error: { code: JSON_RPC_ERROR.PARSE },
      });
      expect(await handleMcpRpcBody(undefined)).toMatchObject({
        error: { code: JSON_RPC_ERROR.PARSE },
      });
    });

    it("reports JSON that is not a request object", async () => {
      expect(await handleMcpRpcBody(5)).toMatchObject({
        error: { code: JSON_RPC_ERROR.INVALID_REQUEST },
      });
    });
  });
});
