import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each request() call gets its own mockReq so write calls don't bleed
const mockReqs: Array<{
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("node:https", () => ({
  request: vi.fn(() => {
    const mockReq = {
      end: vi.fn(),
      on: vi.fn().mockReturnThis(),
      write: vi.fn(),
    };
    mockReqs.push(mockReq);
    return mockReq;
  }),
}));

vi.mock("node:os", () => ({
  hostname: vi.fn(() => "test-host"),
}));

import { request } from "node:https";

import {
  _resetDatadogTransport,
  getDatadogTransport,
  isDatadogForwardingEnabled,
} from "../datadogTransport";
import { out } from "../utils";

/** Helper: get the JSON body written to the most recent request */
function lastWrittenBody(): unknown[] {
  const last = mockReqs[mockReqs.length - 1];
  return JSON.parse(last.write.mock.calls[0][0]);
}

describe("datadogTransport", () => {
  beforeEach(() => {
    _resetDatadogTransport();
    vi.unstubAllEnvs();
    mockReqs.length = 0;
    vi.mocked(request).mockClear();
  });

  afterEach(() => {
    _resetDatadogTransport();
    vi.unstubAllEnvs();
  });

  describe("isDatadogForwardingEnabled", () => {
    it("returns false when no env vars set", () => {
      expect(isDatadogForwardingEnabled()).toBe(false);
    });

    it("returns false when only DATADOG_LOCAL_FORWARDING is set", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      expect(isDatadogForwardingEnabled()).toBe(false);
    });

    it("returns false when only DATADOG_API_KEY is set", () => {
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      expect(isDatadogForwardingEnabled()).toBe(false);
    });

    it("returns true when both env vars are set", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      expect(isDatadogForwardingEnabled()).toBe(true);
    });

    it("returns false when forwarding is explicitly false", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "false");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      expect(isDatadogForwardingEnabled()).toBe(false);
    });

    it("returns false when forwarding is '0'", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "0");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      expect(isDatadogForwardingEnabled()).toBe(false);
    });

    it("returns false when forwarding is 'no'", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "no");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      expect(isDatadogForwardingEnabled()).toBe(false);
    });
  });

  describe("getDatadogTransport", () => {
    it("returns null when disabled", () => {
      expect(getDatadogTransport()).toBeNull();
    });

    it("returns transport when enabled", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      const transport = getDatadogTransport();
      expect(transport).not.toBeNull();
    });

    it("returns same instance on subsequent calls", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      const first = getDatadogTransport();
      const second = getDatadogTransport();
      expect(first).toBe(second);
    });
  });

  describe("DatadogLogTransport.send", () => {
    beforeEach(() => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
    });

    it("buffers a log entry", () => {
      const transport = getDatadogTransport()!;
      transport.send('{"message":"hello"}', "info");
      transport.flush();
      expect(request).toHaveBeenCalled();
    });

    it("maps trace level to debug status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "trace");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("debug");
    });

    it("maps debug level to debug status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "debug");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("debug");
    });

    it("maps info level to info status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("info");
    });

    it("maps warn level to warn status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "warn");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("warn");
    });

    it("maps error level to error status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "error");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("error");
    });

    it("maps fatal level to critical status", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "fatal");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].status).toBe("critical");
    });

    it("extracts message from JSON string as DD message", () => {
      const transport = getDatadogTransport()!;
      transport.send(
        JSON.stringify({ log: "trace", message: "Creating evaluation" }),
        "trace",
      );
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].message).toBe("Creating evaluation");
    });

    it("excludes 'log' field from entry (level is in status)", () => {
      const transport = getDatadogTransport()!;
      transport.send(
        JSON.stringify({
          log: "trace",
          message: "Creating evaluation",
          project: "garden",
        }),
        "trace",
      );
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0]).not.toHaveProperty("log");
    });

    it("spreads extra JSON fields as top-level attributes", () => {
      const transport = getDatadogTransport()!;
      transport.send(
        JSON.stringify({
          log: "info",
          message: "User login",
          project: "garden",
          requestId: "abc-123",
        }),
        "info",
      );
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].project).toBe("garden");
      expect(body[0].requestId).toBe("abc-123");
    });

    it("falls back to raw string for non-JSON input", () => {
      const transport = getDatadogTransport()!;
      transport.send("plain text message", "info");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].message).toBe("plain text message");
    });

    it("falls back to full JSON string when message field is missing", () => {
      const transport = getDatadogTransport()!;
      const line = JSON.stringify({ log: "info", data: "some data" });
      transport.send(line, "info");
      transport.flush();
      const body = lastWrittenBody() as any[];
      expect(body[0].message).toBe(line);
    });
  });

  describe("DatadogLogTransport.flush", () => {
    beforeEach(() => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
    });

    it("does nothing when buffer is empty", () => {
      const transport = getDatadogTransport()!;
      transport.flush();
      expect(request).not.toHaveBeenCalled();
    });

    it("sends correct payload structure", () => {
      const transport = getDatadogTransport()!;
      transport.send('{"log":"info","message":"hello"}', "info");
      transport.flush();

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "DD-API-KEY": "test-key",
          }),
          hostname: "http-intake.logs.datadoghq.com",
          method: "POST",
          path: "/api/v2/logs",
        }),
        expect.any(Function),
      );
    });

    it("includes ddsource and ddtags in entries", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].ddsource).toBe("nodejs");
      expect(body[0].ddtags).toMatch(/^env:/);
    });

    it("uses custom DD_SITE when set", () => {
      _resetDatadogTransport();
      vi.stubEnv("DD_SITE", "datadoghq.eu");
      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "http-intake.logs.datadoghq.eu",
        }),
        expect.any(Function),
      );
    });

    it("clears buffer after flush", () => {
      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();
      vi.mocked(request).mockClear();
      transport.flush();
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe("Tag resolution", () => {
    it("uses DD_SERVICE over PROJECT_SERVICE", () => {
      vi.stubEnv("DD_SERVICE", "dd-svc");
      vi.stubEnv("PROJECT_SERVICE", "proj-svc");
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].service).toBe("dd-svc");
    });

    it("falls back to PROJECT_SERVICE", () => {
      vi.stubEnv("DD_SERVICE", "");
      vi.stubEnv("PROJECT_SERVICE", "proj-svc");
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].service).toBe("proj-svc");
    });

    it("defaults service to 'unknown'", () => {
      vi.stubEnv("DD_SERVICE", "");
      vi.stubEnv("PROJECT_SERVICE", "");
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].service).toBe("unknown");
    });

    it("uses DD_ENV over PROJECT_ENV", () => {
      vi.stubEnv("DD_ENV", "staging");
      vi.stubEnv("PROJECT_ENV", "production");
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].ddtags).toBe("env:staging");
    });

    it("uses os.hostname as fallback for hostname", () => {
      vi.stubEnv("DD_HOST", "");
      vi.stubEnv("PROJECT_HOST", "");
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const transport = getDatadogTransport()!;
      transport.send("test", "info");
      transport.flush();

      const body = lastWrittenBody() as any[];
      expect(body[0].hostname).toBe("test-host");
    });
  });

  describe("_resetDatadogTransport", () => {
    it("clears the singleton so a new instance is created", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");

      const first = getDatadogTransport();
      _resetDatadogTransport();
      const second = getDatadogTransport();
      expect(first).not.toBe(second);
    });
  });

  describe("Integration with out()", () => {
    beforeEach(() => {
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("sends to transport when enabled", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      _resetDatadogTransport();

      out("test message", { level: "info" });

      const transport = getDatadogTransport()!;
      transport.flush();
      expect(request).toHaveBeenCalled();
    });

    it("still outputs to console when transport is enabled", () => {
      vi.stubEnv("DATADOG_LOCAL_FORWARDING", "true");
      vi.stubEnv("DATADOG_API_KEY", "test-key");
      _resetDatadogTransport();

      out("test message", { level: "info" });
      // eslint-disable-next-line no-console
      expect(console.info).toHaveBeenCalledWith("test message");
    });

    it("does not call transport when disabled", () => {
      out("test message", { level: "info" });
      expect(request).not.toHaveBeenCalled();
    });
  });
});
