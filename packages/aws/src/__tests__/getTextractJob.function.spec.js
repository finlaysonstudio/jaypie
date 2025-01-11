import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GetDocumentAnalysisCommand,
  JobStatus,
} from "@aws-sdk/client-textract";
import { BadGatewayError } from "jaypie";

// Subject
import getTextractJob from "../getTextractJob.function.js";

//
//
// Constants
//

const TEST_JOB_ID = "test-job-id";
const TEST_NEXT_TOKEN = "next-token";

//
//
// Mock modules
//

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-textract", () => ({
  FeatureType: {
    FORMS: "FORMS",
    LAYOUT: "LAYOUT",
    SIGNATURES: "SIGNATURES",
    TABLES: "TABLES",
  },
  GetDocumentAnalysisCommand: vi.fn(),
  JobStatus: {
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS",
    PARTIAL_SUCCESS: "PARTIAL_SUCCESS",
    SUCCEEDED: "SUCCEEDED",
  },
  TextractClient: vi.fn(() => ({
    send: mockSend,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("GetTextractJob Function", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(getTextractJob).toBeInstanceOf(Function);
    });

    it("Works", async () => {
      mockSend.mockResolvedValueOnce({
        JobStatus: JobStatus.SUCCEEDED,
        Blocks: [],
      });
      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toBeInstanceOf(Array);
    });
  });

  describe("Error Conditions", () => {
    it("throws BadGatewayError when no response from Textract", async () => {
      mockSend.mockResolvedValueOnce(null);
      await expect(async () =>
        getTextractJob(TEST_JOB_ID),
      ).toThrowBadGatewayError();
    });
  });

  describe("Happy Paths", () => {
    it("handles SUCCEEDED status with single page", async () => {
      const mockResponse = {
        JobStatus: JobStatus.SUCCEEDED,
        Blocks: [{ Id: "1" }],
      };
      mockSend.mockResolvedValueOnce(mockResponse);

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([mockResponse]);
    });

    it("handles SUCCEEDED status with pagination", async () => {
      const mockResponse1 = {
        JobStatus: JobStatus.SUCCEEDED,
        Blocks: [{ Id: "1" }],
        NextToken: TEST_NEXT_TOKEN,
      };
      const mockResponse2 = {
        JobStatus: JobStatus.SUCCEEDED,
        Blocks: [{ Id: "2" }],
      };
      mockSend
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([mockResponse1, mockResponse2]);
    });
  });

  describe("Features", () => {
    it("handles IN_PROGRESS status", async () => {
      mockSend.mockResolvedValueOnce({
        JobStatus: JobStatus.IN_PROGRESS,
      });

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([]);
    });

    it("handles FAILED status", async () => {
      mockSend.mockResolvedValueOnce({
        JobStatus: JobStatus.FAILED,
      });

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([]);
    });

    it("handles PARTIAL_SUCCESS status", async () => {
      const mockResponse = {
        JobStatus: JobStatus.PARTIAL_SUCCESS,
        Blocks: [{ Id: "1" }],
      };
      mockSend.mockResolvedValueOnce(mockResponse);

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([mockResponse]);
    });
  });

  describe("Specific Scenarios", () => {
    it("handles unknown job status", async () => {
      mockSend.mockResolvedValueOnce({
        JobStatus: "UNKNOWN_STATUS",
      });

      const responses = await getTextractJob(TEST_JOB_ID);
      expect(responses).toEqual([]);
    });

    it("sends correct parameters to GetDocumentAnalysisCommand", async () => {
      mockSend.mockResolvedValueOnce({
        JobStatus: JobStatus.SUCCEEDED,
      });

      await getTextractJob(TEST_JOB_ID);

      expect(GetDocumentAnalysisCommand).toHaveBeenCalledWith({
        JobId: TEST_JOB_ID,
        MaxResults: 1000,
        NextToken: undefined,
      });
    });
  });
});
