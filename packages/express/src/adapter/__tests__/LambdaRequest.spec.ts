import { describe, expect, it } from "vitest";

import { createLambdaRequest, LambdaRequest } from "../LambdaRequest.js";
import type {
  ApiGatewayV1Event,
  FunctionUrlEvent,
  LambdaContext,
} from "../types.js";

//
//
// Test Fixtures
//

const mockContext: LambdaContext = {
  awsRequestId: "test-request-id-12345",
  functionName: "test-function",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:test",
  logGroupName: "/aws/lambda/test",
  logStreamName: "2024/01/01/[$LATEST]abc123",
  memoryLimitInMB: "128",
};

const createMockEvent = (
  overrides: Partial<FunctionUrlEvent> = {},
): FunctionUrlEvent => ({
  body: undefined,
  cookies: undefined,
  headers: {
    "content-type": "application/json",
    host: "abc123.lambda-url.us-east-1.on.aws",
    "user-agent": "test-agent",
  },
  isBase64Encoded: false,
  rawPath: "/api/users",
  rawQueryString: "",
  requestContext: {
    accountId: "123456789",
    apiId: "abc123",
    domainName: "abc123.lambda-url.us-east-1.on.aws",
    domainPrefix: "abc123",
    http: {
      method: "GET",
      path: "/api/users",
      protocol: "HTTP/1.1",
      sourceIp: "192.168.1.1",
      userAgent: "test-agent",
    },
    requestId: "req-123",
    routeKey: "$default",
    stage: "$default",
    time: "01/Jan/2024:00:00:00 +0000",
    timeEpoch: 1704067200000,
  },
  routeKey: "$default",
  version: "2.0",
  ...overrides,
});

const createMockV1Event = (
  overrides: Partial<ApiGatewayV1Event> = {},
): ApiGatewayV1Event => ({
  body: null,
  headers: {
    "content-type": "application/json",
    Host: "api.example.com",
    "User-Agent": "test-agent",
  },
  httpMethod: "GET",
  isBase64Encoded: false,
  path: "/api/users",
  queryStringParameters: null,
  requestContext: {
    accountId: "123456789",
    apiId: "abc123",
    domainName: "api.example.com",
    httpMethod: "GET",
    identity: {
      sourceIp: "192.168.1.1",
      userAgent: "test-agent",
    },
    path: "/api/users",
    protocol: "HTTP/1.1",
    requestId: "req-123",
    stage: "prod",
  },
  ...overrides,
});

//
//
// Tests
//

describe("LambdaRequest", () => {
  describe("createLambdaRequest", () => {
    it("creates request from Function URL event", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req).toBeInstanceOf(LambdaRequest);
      expect(req.method).toBe("GET");
      expect(req.url).toBe("/api/users");
      expect(req.path).toBe("/api/users");
      expect(req.originalUrl).toBe("/api/users");
    });

    it("includes query string in URL", () => {
      const event = createMockEvent({
        rawQueryString: "page=1&limit=10",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.url).toBe("/api/users?page=1&limit=10");
      expect(req.path).toBe("/api/users");
    });

    it("normalizes headers to lowercase", () => {
      const event = createMockEvent({
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "custom-value",
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.headers["content-type"]).toBe("application/json");
      expect(req.headers["x-custom-header"]).toBe("custom-value");
    });

    it("normalizes cookies array to Cookie header", () => {
      const event = createMockEvent({
        cookies: ["session=abc123", "user=john"],
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.headers.cookie).toBe("session=abc123; user=john");
    });

    it("preserves existing cookie header over cookies array", () => {
      const event = createMockEvent({
        cookies: ["new=cookie"],
        headers: {
          cookie: "existing=cookie",
          "content-type": "application/json",
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.headers.cookie).toBe("existing=cookie");
    });

    it("stores Lambda context for getCurrentInvokeUuid", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req._lambdaContext).toBe(mockContext);
      expect(req._lambdaContext.awsRequestId).toBe("test-request-id-12345");
    });

    it("stores Lambda event for reference", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req._lambdaEvent).toBe(event);
    });

    it("sets remote address from sourceIp", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.socket.remoteAddress).toBe("192.168.1.1");
      expect(req.connection.remoteAddress).toBe("192.168.1.1");
    });

    it("handles POST method", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.method).toBe("POST");
    });
  });

  describe("body handling", () => {
    it("handles string body", async () => {
      const event = createMockEvent({
        body: '{"name":"John"}',
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();

      expect(body).toBe('{"name":"John"}');
      expect(req.complete).toBe(true);
    });

    it("handles base64 encoded body", async () => {
      const originalBody = '{"name":"John"}';
      const base64Body = Buffer.from(originalBody).toString("base64");
      const event = createMockEvent({
        body: base64Body,
        isBase64Encoded: true,
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();

      expect(body).toBe('{"name":"John"}');
    });

    it("handles empty body", async () => {
      const event = createMockEvent({
        body: undefined,
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }

      expect(chunks.length).toBe(0);
      expect(req.complete).toBe(true);
    });
  });

  describe("Express helper methods", () => {
    it("get() returns header value", () => {
      const event = createMockEvent({
        headers: {
          "content-type": "application/json",
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.get("Content-Type")).toBe("application/json");
      expect(req.get("content-type")).toBe("application/json");
    });

    it("header() is alias for get()", () => {
      const event = createMockEvent({
        headers: {
          "x-custom": "value",
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.header("X-Custom")).toBe("value");
    });

    it("get() returns undefined for missing header", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.get("x-missing")).toBeUndefined();
    });
  });

  describe("socket mock", () => {
    it("sets encrypted based on protocol", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            protocol: "HTTPS/1.1",
          },
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.socket.encrypted).toBe(true);
    });

    it("sets encrypted to false for HTTP", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.socket.encrypted).toBe(false);
    });

    it("destroy() is a no-op", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(() => req.socket.destroy()).not.toThrow();
    });
  });

  describe("default properties", () => {
    it("sets httpVersion", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.httpVersion).toBe("1.1");
      expect(req.httpVersionMajor).toBe(1);
      expect(req.httpVersionMinor).toBe(1);
    });

    it("initializes baseUrl as empty string", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.baseUrl).toBe("");
    });

    it("initializes params as empty object", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.params).toEqual({});
    });

    it("initializes query as empty object", () => {
      const event = createMockEvent();
      const req = createLambdaRequest(event, mockContext);

      expect(req.query).toEqual({});
    });
  });

  describe("API Gateway REST API v1 events", () => {
    it("creates request from API Gateway v1 event", () => {
      const event = createMockV1Event();
      const req = createLambdaRequest(event, mockContext);

      expect(req).toBeInstanceOf(LambdaRequest);
      expect(req.method).toBe("GET");
      expect(req.url).toBe("/api/users");
      expect(req.path).toBe("/api/users");
    });

    it("includes query string in URL from queryStringParameters", () => {
      const event = createMockV1Event({
        queryStringParameters: { page: "1", limit: "10" },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.url).toBe("/api/users?page=1&limit=10");
      expect(req.path).toBe("/api/users");
    });

    it("handles POST method", () => {
      const event = createMockV1Event({
        httpMethod: "POST",
        requestContext: {
          ...createMockV1Event().requestContext,
          httpMethod: "POST",
        },
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.method).toBe("POST");
    });

    it("sets remote address from identity.sourceIp", () => {
      const event = createMockV1Event();
      const req = createLambdaRequest(event, mockContext);

      expect(req.socket.remoteAddress).toBe("192.168.1.1");
    });

    it("handles string body", async () => {
      const event = createMockV1Event({
        body: '{"name":"John"}',
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();

      expect(body).toBe('{"name":"John"}');
    });

    it("handles base64 encoded body", async () => {
      const originalBody = '{"name":"John"}';
      const base64Body = Buffer.from(originalBody).toString("base64");
      const event = createMockV1Event({
        body: base64Body,
        isBase64Encoded: true,
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();

      expect(body).toBe('{"name":"John"}');
    });

    it("handles null body", async () => {
      const event = createMockV1Event({
        body: null,
      });
      const req = createLambdaRequest(event, mockContext);

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }

      expect(chunks.length).toBe(0);
    });

    it("stores Lambda context for getCurrentInvokeUuid", () => {
      const event = createMockV1Event();
      const req = createLambdaRequest(event, mockContext);

      expect(req._lambdaContext).toBe(mockContext);
      expect(req._lambdaContext.awsRequestId).toBe("test-request-id-12345");
    });

    it("stores Lambda event for reference", () => {
      const event = createMockV1Event();
      const req = createLambdaRequest(event, mockContext);

      expect(req._lambdaEvent).toBe(event);
    });

    describe("multi-value query parameters", () => {
      it("handles multiValueQueryStringParameters with array values", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: {
            filterByStatus: ["APPROVED", "RESOLVED"],
          },
          queryStringParameters: { filterByStatus: "RESOLVED" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.query.filterByStatus).toEqual(["APPROVED", "RESOLVED"]);
      });

      it("normalizes bracket notation (filterByStatus[] -> filterByStatus)", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: {
            "filterByStatus[]": ["APPROVED", "RESOLVED"],
          },
          queryStringParameters: { "filterByStatus[]": "RESOLVED" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.query.filterByStatus).toEqual(["APPROVED", "RESOLVED"]);
        expect(req.query["filterByStatus[]"]).toBeUndefined();
      });

      it("keeps single values as strings when not using bracket notation", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: {
            page: ["1"],
            limit: ["10"],
          },
          queryStringParameters: { page: "1", limit: "10" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.query.page).toBe("1");
        expect(req.query.limit).toBe("10");
      });

      it("keeps single values as arrays when using bracket notation", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: {
            "tags[]": ["javascript"],
          },
          queryStringParameters: { "tags[]": "javascript" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.query.tags).toEqual(["javascript"]);
      });

      it("handles mixed single and multi-value parameters", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: {
            page: ["1"],
            "status[]": ["ACTIVE", "PENDING"],
          },
          queryStringParameters: { page: "1", "status[]": "PENDING" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.query.page).toBe("1");
        expect(req.query.status).toEqual(["ACTIVE", "PENDING"]);
      });

      it("falls back to URL parsing when multiValueQueryStringParameters is null", () => {
        const event = createMockV1Event({
          multiValueQueryStringParameters: null,
          queryStringParameters: { page: "1" },
        });
        const req = createLambdaRequest(event, mockContext);

        expect(req.url).toBe("/api/users?page=1");
        // Query is parsed from URL when no pre-built query is provided
        expect(req.query.page).toBe("1");
      });
    });
  });

  describe("Function URL multi-value query parameters", () => {
    it("handles duplicate query parameters", () => {
      const event = createMockEvent({
        rawQueryString: "status=ACTIVE&status=PENDING",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.query.status).toEqual(["ACTIVE", "PENDING"]);
    });

    it("normalizes bracket notation in rawQueryString", () => {
      const event = createMockEvent({
        rawQueryString: "filterByStatus[]=APPROVED&filterByStatus[]=RESOLVED",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.query.filterByStatus).toEqual(["APPROVED", "RESOLVED"]);
      expect(req.query["filterByStatus[]"]).toBeUndefined();
    });

    it("keeps single values as strings without bracket notation", () => {
      const event = createMockEvent({
        rawQueryString: "page=1&limit=10",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.query.page).toBe("1");
      expect(req.query.limit).toBe("10");
    });

    it("keeps single values as arrays with bracket notation", () => {
      const event = createMockEvent({
        rawQueryString: "tags[]=javascript",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.query.tags).toEqual(["javascript"]);
    });

    it("handles mixed bracket and non-bracket notation", () => {
      const event = createMockEvent({
        rawQueryString: "page=1&status[]=ACTIVE&status[]=PENDING",
      });
      const req = createLambdaRequest(event, mockContext);

      expect(req.query.page).toBe("1");
      expect(req.query.status).toEqual(["ACTIVE", "PENDING"]);
    });
  });
});
