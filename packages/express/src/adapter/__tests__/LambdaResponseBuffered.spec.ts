import { describe, expect, it } from "vitest";

import LambdaResponseBuffered from "../LambdaResponseBuffered.js";

//
//
// Tests
//

describe("LambdaResponseBuffered", () => {
  describe("constructor", () => {
    it("creates response with default status", () => {
      const res = new LambdaResponseBuffered();

      expect(res.statusCode).toBe(200);
      expect(res.statusMessage).toBe("OK");
    });
  });

  describe("status management", () => {
    it("status() sets statusCode", () => {
      const res = new LambdaResponseBuffered();
      res.status(404);

      expect(res.statusCode).toBe(404);
    });

    it("status() returns this for chaining", () => {
      const res = new LambdaResponseBuffered();
      const result = res.status(201);

      expect(result).toBe(res);
    });
  });

  describe("header management", () => {
    it("setHeader() stores header", () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("Content-Type", "application/json");

      expect(res.getHeader("content-type")).toBe("application/json");
    });

    it("setHeader() normalizes header name to lowercase", () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("X-Custom-Header", "value");

      expect(res.getHeader("x-custom-header")).toBe("value");
    });

    it("getHeaders() returns all headers", () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "application/json");
      res.setHeader("x-custom", "value");

      const headers = res.getHeaders();

      expect(headers["content-type"]).toBe("application/json");
      expect(headers["x-custom"]).toBe("value");
    });

    it("hasHeader() returns true for existing header", () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "application/json");

      expect(res.hasHeader("content-type")).toBe(true);
      expect(res.hasHeader("Content-Type")).toBe(true);
    });

    it("hasHeader() returns false for missing header", () => {
      const res = new LambdaResponseBuffered();

      expect(res.hasHeader("x-missing")).toBe(false);
    });

    it("removeHeader() removes header", () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("x-custom", "value");
      res.removeHeader("x-custom");

      expect(res.hasHeader("x-custom")).toBe(false);
    });
  });

  describe("writeHead()", () => {
    it("sets status code", () => {
      const res = new LambdaResponseBuffered();
      res.writeHead(201);

      expect(res.statusCode).toBe(201);
    });

    it("sets status message", () => {
      const res = new LambdaResponseBuffered();
      res.writeHead(201, "Created");

      expect(res.statusCode).toBe(201);
      expect(res.statusMessage).toBe("Created");
    });

    it("sets headers from object", () => {
      const res = new LambdaResponseBuffered();
      res.writeHead(200, { "content-type": "text/plain" });

      expect(res.getHeader("content-type")).toBe("text/plain");
    });

    it("sets headers with status message", () => {
      const res = new LambdaResponseBuffered();
      res.writeHead(200, "OK", { "x-custom": "value" });

      expect(res.getHeader("x-custom")).toBe("value");
    });

    it("marks headers as sent", () => {
      const res = new LambdaResponseBuffered();

      expect(res.headersSent).toBe(false);
      res.writeHead(200);
      expect(res.headersSent).toBe(true);
    });
  });

  describe("write() and end()", () => {
    it("collects body chunks", async () => {
      const res = new LambdaResponseBuffered();
      res.write("Hello ");
      res.write("World");
      res.end();

      const result = await res.getResult();

      expect(result.body).toBe("Hello World");
    });

    it("handles Buffer chunks", async () => {
      const res = new LambdaResponseBuffered();
      res.write(Buffer.from("Hello"));
      res.end();

      const result = await res.getResult();

      expect(result.body).toBe("Hello");
    });

    it("end() with data writes final chunk", async () => {
      const res = new LambdaResponseBuffered();
      res.write("Hello ");
      res.end("World");

      const result = await res.getResult();

      expect(result.body).toBe("Hello World");
    });
  });

  describe("json()", () => {
    it("sets content-type header", async () => {
      const res = new LambdaResponseBuffered();
      res.json({ message: "Hello" });

      const result = await res.getResult();

      expect(result.headers["content-type"]).toBe("application/json");
    });

    it("serializes object to JSON", async () => {
      const res = new LambdaResponseBuffered();
      res.json({ message: "Hello", count: 42 });

      const result = await res.getResult();

      expect(result.body).toBe('{"message":"Hello","count":42}');
    });
  });

  describe("send()", () => {
    it("sends string body", async () => {
      const res = new LambdaResponseBuffered();
      res.send("Hello World");

      const result = await res.getResult();

      expect(result.body).toBe("Hello World");
    });

    it("sends object as JSON", async () => {
      const res = new LambdaResponseBuffered();
      res.send({ message: "Hello" });

      const result = await res.getResult();

      expect(result.body).toBe('{"message":"Hello"}');
      expect(result.headers["content-type"]).toBe("application/json");
    });

    it("sends Buffer body", async () => {
      const res = new LambdaResponseBuffered();
      res.send(Buffer.from("Hello"));

      const result = await res.getResult();

      expect(result.body).toBe("Hello");
    });
  });

  describe("getResult()", () => {
    it("returns complete Lambda response", async () => {
      const res = new LambdaResponseBuffered();
      res.status(201);
      res.setHeader("content-type", "application/json");
      res.json({ created: true });

      const result = await res.getResult();

      expect(result.statusCode).toBe(201);
      expect(result.headers["content-type"]).toBe("application/json");
      expect(result.body).toBe('{"created":true}');
      expect(result.isBase64Encoded).toBe(false);
    });

    it("resolves immediately if already ended", async () => {
      const res = new LambdaResponseBuffered();
      res.end("Done");

      const result = await res.getResult();

      expect(result.body).toBe("Done");
    });

    it("waits for end() if not ended", async () => {
      const res = new LambdaResponseBuffered();

      // Start getting result before ending
      const resultPromise = res.getResult();

      // End after a short delay
      setTimeout(() => res.end("Delayed"), 10);

      const result = await resultPromise;

      expect(result.body).toBe("Delayed");
    });
  });

  describe("binary response handling", () => {
    it("base64 encodes image responses", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "image/png");
      const imageData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      res.end(imageData);

      const result = await res.getResult();

      expect(result.isBase64Encoded).toBe(true);
      expect(result.body).toBe(imageData.toString("base64"));
    });

    it("base64 encodes application/pdf", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "application/pdf");
      res.end(Buffer.from("PDF content"));

      const result = await res.getResult();

      expect(result.isBase64Encoded).toBe(true);
    });

    it("base64 encodes application/octet-stream", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "application/octet-stream");
      res.end(Buffer.from("binary data"));

      const result = await res.getResult();

      expect(result.isBase64Encoded).toBe(true);
    });

    it("does not base64 encode text responses", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "text/html");
      res.end("<html></html>");

      const result = await res.getResult();

      expect(result.isBase64Encoded).toBe(false);
    });

    it("does not base64 encode JSON responses", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "application/json");
      res.end('{"data":true}');

      const result = await res.getResult();

      expect(result.isBase64Encoded).toBe(false);
    });
  });

  describe("cookie handling", () => {
    it("extracts Set-Cookie headers to cookies array", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("set-cookie", "session=abc123; Path=/");
      res.end();

      const result = await res.getResult();

      expect(result.cookies).toEqual(["session=abc123; Path=/"]);
    });

    it("excludes cookies from headers object", async () => {
      const res = new LambdaResponseBuffered();
      res.setHeader("content-type", "text/html");
      res.setHeader("set-cookie", "session=abc123");
      res.end();

      const result = await res.getResult();

      expect(result.headers["set-cookie"]).toBeUndefined();
      expect(result.cookies).toEqual(["session=abc123"]);
    });

    it("omits cookies array if no Set-Cookie headers", async () => {
      const res = new LambdaResponseBuffered();
      res.end("Hello");

      const result = await res.getResult();

      expect(result.cookies).toBeUndefined();
    });
  });
});
