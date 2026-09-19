import { afterEach, describe, expect, it, vi } from "vitest";

import { PROVIDER } from "../../../constants.js";
import {
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../../errors/LlmError.js";
import { LlamaCloudClient } from "../client.js";

function mockFetch({
  body,
  headers = {},
  ok = true,
  status = 200,
}: {
  body: unknown;
  headers?: Record<string, string>;
  ok?: boolean;
  status?: number;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    arrayBuffer: async () => Buffer.from("png-bytes"),
    headers: new Headers(headers),
    json: async () => body,
    ok,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CONFIGURATION = { tier: "agentic", version: "2026-09-13" } as const;

describe("LlamaCloudClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(LlamaCloudClient).toBeFunction();
    expect(new LlamaCloudClient({ apiKey: "_MOCK_KEY" })).toBeInstanceOf(
      LlamaCloudClient,
    );
  });

  describe("Happy Paths", () => {
    it("Posts a JSON configuration to the parse route", async () => {
      const fetchMock = mockFetch({ body: { id: "pjb-1", status: "PENDING" } });
      const job = await new LlamaCloudClient({
        apiKey: "_MOCK_KEY",
      }).createParse({ ...CONFIGURATION, source_url: "https://x.test/a.pdf" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${PROVIDER.LLAMACLOUD.BASE_URL}/parse`);
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer _MOCK_KEY");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual({
        ...CONFIGURATION,
        source_url: "https://x.test/a.pdf",
      });
      expect(job.id).toBe("pjb-1");
    });

    it("Uploads bytes as multipart with the configuration as a JSON string", async () => {
      const fetchMock = mockFetch({ body: { id: "pjb-2", status: "PENDING" } });
      await new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).uploadParse({
        buffer: Buffer.from("%PDF"),
        configuration: CONFIGURATION,
        filename: "scan.pdf",
        mimeType: "application/pdf",
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${PROVIDER.LLAMACLOUD.BASE_URL}/parse/upload`);
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      const file = form.get("file") as File;
      expect(file.name).toBe("scan.pdf");
      expect(file.type).toBe("application/pdf");
      expect(JSON.parse(form.get("configuration") as string)).toEqual(
        CONFIGURATION,
      );
      // fetch sets the multipart boundary; a manual Content-Type would break it
      expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("Polls a job with repeated expand parameters", async () => {
      const fetchMock = mockFetch({
        body: { job: { id: "pjb-3", status: "COMPLETED" } },
      });
      await new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).getParse("pjb-3", {
        expand: ["markdown", "usage"],
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        `${PROVIDER.LLAMACLOUD.BASE_URL}/parse/pjb-3?expand=markdown&expand=usage`,
      );
      expect(init.method).toBe("GET");
    });

    it("Polls a job with no expand when none is given", async () => {
      const fetchMock = mockFetch({
        body: { job: { id: "pjb-3", status: "RUNNING" } },
      });
      await new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).getParse("pjb-3");
      expect(fetchMock.mock.calls[0][0]).toBe(
        `${PROVIDER.LLAMACLOUD.BASE_URL}/parse/pjb-3`,
      );
    });

    it("Downloads a presigned image as a data URI", async () => {
      mockFetch({ body: null, headers: { "content-type": "image/png" } });
      const image = await new LlamaCloudClient({
        apiKey: "_MOCK_KEY",
      }).fetchImage("https://signed.test/image_0.png");
      expect(image.mimeType).toBe("image/png");
      expect(image.data).toBe(
        `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`,
      );
    });
  });

  describe("Error Conditions", () => {
    it("Maps 401 to unrecoverable with the detail", async () => {
      mockFetch({ body: { detail: "bad key" }, ok: false, status: 401 });
      await expect(
        new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).getParse("x"),
      ).rejects.toThrow(LlmUnrecoverableError);
      await expect(
        new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).getParse("x"),
      ).rejects.toThrow(/401.*bad key/);
    });

    it("Renders FastAPI validation details field by field", async () => {
      mockFetch({
        body: {
          detail: [{ loc: ["body", "tier"], msg: "Input should be 'fast'" }],
        },
        ok: false,
        status: 422,
      });
      await expect(
        new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).createParse(
          CONFIGURATION,
        ),
      ).rejects.toThrow(/body\.tier: Input should be 'fast'/);
    });

    it("Maps 429 to a rate limit carrying retry-after", async () => {
      mockFetch({
        body: { detail: "slow down" },
        headers: { "retry-after": "7" },
        ok: false,
        status: 429,
      });
      const error = await new LlamaCloudClient({ apiKey: "_MOCK_KEY" })
        .getParse("x")
        .catch((e) => e);
      expect(error).toBeInstanceOf(LlmRateLimitError);
      expect(error.retryAfterMs).toBe(7000);
      expect(error.provider).toBe(PROVIDER.LLAMACLOUD.NAME);
    });

    it("Maps 5xx to transient", async () => {
      mockFetch({ body: { detail: "boom" }, ok: false, status: 503 });
      await expect(
        new LlamaCloudClient({ apiKey: "_MOCK_KEY" }).getParse("x"),
      ).rejects.toThrow(LlmTransientError);
    });
  });
});
