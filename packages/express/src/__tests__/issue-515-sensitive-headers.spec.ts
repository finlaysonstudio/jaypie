import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPRESS } from "../constants.js";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");

//
//
// Helpers
//

interface LoggedRequest {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

function loggedRequest(): LoggedRequest {
  const call = (
    log.info.var as unknown as { mock: { calls: unknown[][] } }
  ).mock.calls.find((args) => Boolean((args[0] as { req?: unknown }).req));
  if (!call) throw new Error("Request was never logged");
  return (call[0] as { req: LoggedRequest }).req;
}

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Issue 515: expressHandler sensitive headers and body scrubbing", () => {
  describe("Base Cases", () => {
    it("Publishes the default sensitive header list", () => {
      expect(EXPRESS.HEADER.SENSITIVE).toEqual([
        "authorization",
        "cookie",
        "set-cookie",
      ]);
    });
  });

  describe("Features", () => {
    it("Redacts a header named in sensitiveHeaders", async () => {
      const app = express();
      app.use(express.json());
      app.use(
        expressHandler(() => ({ ok: true }), {
          sensitiveHeaders: ["x-hub-signature-256"],
        }),
      );

      await request(app)
        .post("/")
        .set("x-hub-signature-256", "sha256=deadbeefdeadbeef")
        .send({ hello: "world" });

      const logged = loggedRequest();
      expect(logged.headers["x-hub-signature-256"]).not.toBe(
        "sha256=deadbeefdeadbeef",
      );
    });

    it("Matches sensitiveHeaders without regard to case", async () => {
      const app = express();
      app.use(
        expressHandler(() => ({ ok: true }), {
          sensitiveHeaders: ["X-Slack-Signature"],
        }),
      );

      await request(app).get("/").set("x-slack-signature", "v0=abcdef123456");

      const logged = loggedRequest();
      expect(logged.headers["x-slack-signature"]).not.toBe("v0=abcdef123456");
    });

    it("Omits the body when logBody is false", async () => {
      const app = express();
      app.use(express.json());
      app.use(expressHandler(() => ({ ok: true }), { logBody: false }));

      await request(app).post("/").send({ secret: "third-party-payload" });

      const logged = loggedRequest();
      expect(logged).not.toHaveProperty("body");
    });
  });

  describe("Defaults Unchanged", () => {
    it("Redacts authorization without any option", async () => {
      const app = express();
      app.use(expressHandler(() => ({ ok: true })));

      await request(app)
        .get("/")
        .set("authorization", "Bearer sk-proj-abc1234");

      const logged = loggedRequest();
      expect(logged.headers.authorization).not.toBe("Bearer sk-proj-abc1234");
    });

    it("Logs the body and leaves other headers alone", async () => {
      const app = express();
      app.use(express.json());
      app.use(
        expressHandler(() => ({ ok: true }), {
          sensitiveHeaders: ["x-hub-signature-256"],
        }),
      );

      await request(app)
        .post("/")
        .set("x-request-id", "MOCK_REQUEST_ID")
        .send({ hello: "world" });

      const logged = loggedRequest();
      expect(logged.body).toEqual({ hello: "world" });
      expect(logged.headers["x-request-id"]).toBe("MOCK_REQUEST_ID");
    });
  });
});
