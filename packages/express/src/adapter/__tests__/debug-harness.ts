/**
 * Debug harness for testing Lambda adapter locally.
 * Run with: npx tsx src/adapter/__tests__/debug-harness.ts
 */
import express from "express";

import { createLambdaRequest } from "../LambdaRequest.js";
import LambdaResponseBuffered from "../LambdaResponseBuffered.js";
import type { FunctionUrlEvent, LambdaContext } from "../types.js";

//
// Test Fixtures
//

const mockContext: LambdaContext = {
  awsRequestId: "debug-test-request-id",
  functionName: "test-function",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:test",
  logGroupName: "/aws/lambda/test",
  logStreamName: "2024/01/01/[$LATEST]abc123",
  memoryLimitInMB: "128",
};

const mockEvent: FunctionUrlEvent = {
  body: undefined,
  cookies: undefined,
  headers: {
    "content-type": "application/json",
    host: "test.lambda-url.us-east-1.on.aws",
  },
  isBase64Encoded: false,
  rawPath: "/",
  rawQueryString: "",
  requestContext: {
    accountId: "123456789",
    apiId: "abc123",
    domainName: "test.lambda-url.us-east-1.on.aws",
    domainPrefix: "test",
    http: {
      method: "GET",
      path: "/",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test",
    },
    requestId: "req-debug",
    routeKey: "$default",
    stage: "$default",
    time: "01/Jan/2024:00:00:00 +0000",
    timeEpoch: 1704067200000,
  },
  routeKey: "$default",
  version: "2.0",
};

//
// Debug Test
//

async function runDebugTest() {
  console.log("=== Starting Debug Test ===\n");

  // Create Express app
  const app = express();
  app.get("/", (_req, res) => {
    console.log("Handler: Received request, calling res.json()");
    res.json({ message: "Hello World" });
    console.log("Handler: res.json() returned");
  });

  // Create mock request
  const req = createLambdaRequest(mockEvent, mockContext);
  console.log("Created LambdaRequest");

  // Create buffered response
  const res = new LambdaResponseBuffered();
  console.log("Created LambdaResponseBuffered");

  // Debug: Check prototype chain
  console.log("\nPrototype chain analysis:");
  console.log("  res.constructor.name:", res.constructor.name);
  console.log("  res has own removeHeader:", Object.prototype.hasOwnProperty.call(res, 'removeHeader'));
  console.log("  removeHeader in res:", 'removeHeader' in res);
  console.log("  typeof res.removeHeader:", typeof res.removeHeader);

  // Override removeHeader to trace calls
  const originalRemoveHeader = res.removeHeader.bind(res);
  res.removeHeader = function(name: string) {
    console.log("OUR removeHeader called with:", name);
    return originalRemoveHeader(name);
  };

  // Override setHeader to trace calls
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    console.log("OUR setHeader called with:", name, "=", value);
    return originalSetHeader(name, value);
  } as typeof res.setHeader;

  // Override json to trace calls
  const originalJson = res.json.bind(res);
  res.json = function(this: typeof res, data: unknown) {
    console.log("OUR json() called with:", data);
    console.log("  this.json === res.json:", this.json === res.json);
    console.log("  this.constructor.name:", this.constructor.name);
    return originalJson(data);
  } as typeof res.json;

  // Override getHeader to trace calls
  const originalGetHeader = res.getHeader.bind(res);
  res.getHeader = function(name: string) {
    console.log("OUR getHeader called with:", name);
    return originalGetHeader(name);
  } as typeof res.getHeader;

  // Override get to trace calls
  const originalGet = res.get.bind(res);
  res.get = function(name: string) {
    console.log("OUR get() called with:", name);
    return originalGet(name);
  } as typeof res.get;

  // Add event listeners for debugging
  res.on("finish", () => {
    console.log("Event: finish emitted");
  });
  res.on("close", () => {
    console.log("Event: close emitted");
  });
  res.on("error", (err) => {
    console.log("Event: error emitted", err);
  });
  res.on("pipe", () => {
    console.log("Event: pipe emitted");
  });
  res.on("unpipe", () => {
    console.log("Event: unpipe emitted");
  });
  res.on("drain", () => {
    console.log("Event: drain emitted");
  });

  // Override end to trace calls
  const originalEnd = res.end.bind(res);
  res.end = function (...args: Parameters<typeof originalEnd>) {
    console.log("res.end() called with args:", args.map(a => typeof a === 'function' ? '[callback]' : a));
    console.log("Stack trace:", new Error().stack);
    return originalEnd(...args);
  } as typeof res.end;

  // Run Express app
  console.log("\nRunning Express app...");

  const runPromise = new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("error", reject);

    // Cast and run
    app(req as any, res as any);
  });

  // Add timeout
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout after 5s")), 5000);
  });

  try {
    await Promise.race([runPromise, timeoutPromise]);
    console.log("\nExpress app completed!");

    // Get result
    const result = await res.getResult();
    console.log("\nResult:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\nError:", error);
    console.log("\nResponse state:");
    console.log("  writableEnded:", res.writableEnded);
    console.log("  writableFinished:", res.writableFinished);
    console.log("  _headersSent:", res._headersSent);
    console.log("  _chunks:", res._chunks.length, "chunks");
    console.log("  _headers:", Object.fromEntries(res._headers));
    console.log("  statusCode:", res.statusCode);
  }
}

runDebugTest().catch(console.error);
