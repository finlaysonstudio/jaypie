import { afterEach, describe, expect, it, vi } from "vitest";
import { StartDocumentAnalysisCommand } from "@aws-sdk/client-textract";

// Subject
import sendTextractJob from "../sendTextractJob.function.js";

//
//
// Constants
//

const TEST_BUCKET = "test-bucket";
const TEST_JOB_ID = "test-job-id";
const TEST_KEY = "test-key";
const TEST_ROLE_ARN = "test-role-arn";
const TEST_TOPIC_ARN = "test-topic-arn";

//
//
// Mock modules
//

vi.mock("@aws-sdk/client-textract", () => {
  const mockSend = vi.fn().mockResolvedValue({ JobId: "test-job-id" });

  return {
    FeatureType: {
      FORMS: "FORMS",
      LAYOUT: "LAYOUT",
      SIGNATURES: "SIGNATURES",
      TABLES: "TABLES",
    },
    StartDocumentAnalysisCommand: vi.fn(),
    TextractClient: vi.fn(() => ({
      send: mockSend,
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("SendTextractJob Function", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(sendTextractJob).toBeInstanceOf(Function);
    });

    it("Works", async () => {
      const response = await sendTextractJob({
        bucket: TEST_BUCKET,
        key: TEST_KEY,
      });
      expect(response).toBe(TEST_JOB_ID);
    });
  });

  describe("Error Conditions", () => {
    it("throws ConfigurationError when missing key", async () => {
      await expect(async () =>
        sendTextractJob({ bucket: TEST_BUCKET }),
      ).toThrowConfigurationError();
    });

    it("throws ConfigurationError when missing bucket", async () => {
      await expect(async () =>
        sendTextractJob({ key: TEST_KEY }),
      ).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    it("sends command with default feature types", async () => {
      await sendTextractJob({
        bucket: TEST_BUCKET,
        key: TEST_KEY,
      });

      expect(StartDocumentAnalysisCommand).toHaveBeenCalledWith({
        DocumentLocation: {
          S3Object: {
            Bucket: TEST_BUCKET,
            Name: TEST_KEY,
          },
        },
        FeatureTypes: ["FORMS", "LAYOUT", "SIGNATURES", "TABLES"],
      });
    });

    it("includes SNS configuration when provided", async () => {
      await sendTextractJob({
        bucket: TEST_BUCKET,
        key: TEST_KEY,
        snsRoleArn: TEST_ROLE_ARN,
        snsTopicArn: TEST_TOPIC_ARN,
      });

      expect(StartDocumentAnalysisCommand).toHaveBeenCalledWith({
        DocumentLocation: {
          S3Object: {
            Bucket: TEST_BUCKET,
            Name: TEST_KEY,
          },
        },
        FeatureTypes: ["FORMS", "LAYOUT", "SIGNATURES", "TABLES"],
        NotificationChannel: {
          RoleArn: TEST_ROLE_ARN,
          SNSTopicArn: TEST_TOPIC_ARN,
        },
      });
    });
  });

  describe("Features", () => {
    it("accepts custom feature types", async () => {
      await sendTextractJob({
        bucket: TEST_BUCKET,
        featureTypes: ["FORMS"],
        key: TEST_KEY,
      });

      expect(StartDocumentAnalysisCommand).toHaveBeenCalledWith({
        DocumentLocation: {
          S3Object: {
            Bucket: TEST_BUCKET,
            Name: TEST_KEY,
          },
        },
        FeatureTypes: ["FORMS"],
      });
    });
  });
});
