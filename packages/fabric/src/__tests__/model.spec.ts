/**
 * Tests for BaseModel types and utilities
 */

import { describe, expect, it } from "vitest";

import {
  BASE_MODEL_AUTO_FIELDS,
  BASE_MODEL_FIELDS,
  BASE_MODEL_REQUIRED_FIELDS,
  BASE_MODEL_TIMESTAMP_FIELDS,
  createBaseModelInput,
  hasBaseModelShape,
  isAutoField,
  isBaseModel,
  isTimestampField,
  pickBaseModelFields,
  type BaseModel,
  type BaseModelInput,
  type JobModel,
  type MessageModel,
  type Progress,
} from "../models/base.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const validModel: BaseModel = {
  createdAt: new Date("2026-01-01"),
  id: "123e4567-e89b-12d3-a456-426614174000",
  model: "record",
  updatedAt: new Date("2026-01-01"),
};

const fullModel: BaseModel = {
  ...validModel,
  abbreviation: "T",
  alias: "test-model",
  archivedAt: null,
  class: "memory",
  content: "Test content",
  deletedAt: null,
  description: "A test model",
  emoji: "🧪",
  history: [
    {
      delta: { content: "Old content" },
      timestamp: new Date("2026-01-01"),
    },
  ],
  icon: "flask",
  label: "Test",
  metadata: { key: "value" },
  name: "Test Model",
  type: "document",
  xid: "external-123",
};

// =============================================================================
// Constants
// =============================================================================

describe("BASE_MODEL_FIELDS", () => {
  it("contains all expected fields", () => {
    expect(BASE_MODEL_FIELDS.ID).toBe("id");
    expect(BASE_MODEL_FIELDS.MODEL).toBe("model");
    expect(BASE_MODEL_FIELDS.CREATED_AT).toBe("createdAt");
    expect(BASE_MODEL_FIELDS.UPDATED_AT).toBe("updatedAt");
  });

  it("contains schema fields", () => {
    expect(BASE_MODEL_FIELDS.CLASS).toBe("class");
    expect(BASE_MODEL_FIELDS.MODEL).toBe("model");
    expect(BASE_MODEL_FIELDS.TYPE).toBe("type");
  });

  it("contains optional identity fields", () => {
    expect(BASE_MODEL_FIELDS.ABBREVIATION).toBe("abbreviation");
    expect(BASE_MODEL_FIELDS.ALIAS).toBe("alias");
    expect(BASE_MODEL_FIELDS.DESCRIPTION).toBe("description");
    expect(BASE_MODEL_FIELDS.LABEL).toBe("label");
    expect(BASE_MODEL_FIELDS.NAME).toBe("name");
    expect(BASE_MODEL_FIELDS.XID).toBe("xid");
  });

  it("contains content fields", () => {
    expect(BASE_MODEL_FIELDS.CONTENT).toBe("content");
    expect(BASE_MODEL_FIELDS.METADATA).toBe("metadata");
  });

  it("contains display fields", () => {
    expect(BASE_MODEL_FIELDS.EMOJI).toBe("emoji");
    expect(BASE_MODEL_FIELDS.ICON).toBe("icon");
  });

  it("contains lifecycle fields", () => {
    expect(BASE_MODEL_FIELDS.ARCHIVED_AT).toBe("archivedAt");
    expect(BASE_MODEL_FIELDS.DELETED_AT).toBe("deletedAt");
    expect(BASE_MODEL_FIELDS.HISTORY).toBe("history");
  });
});

describe("BASE_MODEL_REQUIRED_FIELDS", () => {
  it("lists all required fields", () => {
    expect(BASE_MODEL_REQUIRED_FIELDS).toContain("id");
    expect(BASE_MODEL_REQUIRED_FIELDS).toContain("model");
    expect(BASE_MODEL_REQUIRED_FIELDS).toContain("createdAt");
    expect(BASE_MODEL_REQUIRED_FIELDS).toContain("updatedAt");
  });

  it("does not include optional fields", () => {
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("class");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("content");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("label");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("alias");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("metadata");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("name");
    expect(BASE_MODEL_REQUIRED_FIELDS).not.toContain("type");
  });
});

describe("BASE_MODEL_AUTO_FIELDS", () => {
  it("lists auto-generated fields", () => {
    expect(BASE_MODEL_AUTO_FIELDS).toContain("id");
    expect(BASE_MODEL_AUTO_FIELDS).toContain("createdAt");
    expect(BASE_MODEL_AUTO_FIELDS).toContain("updatedAt");
    expect(BASE_MODEL_AUTO_FIELDS).toContain("history");
  });

  it("does not include user-provided fields", () => {
    expect(BASE_MODEL_AUTO_FIELDS).not.toContain("name");
    expect(BASE_MODEL_AUTO_FIELDS).not.toContain("content");
  });
});

describe("BASE_MODEL_TIMESTAMP_FIELDS", () => {
  it("lists all timestamp fields", () => {
    expect(BASE_MODEL_TIMESTAMP_FIELDS).toContain("createdAt");
    expect(BASE_MODEL_TIMESTAMP_FIELDS).toContain("updatedAt");
    expect(BASE_MODEL_TIMESTAMP_FIELDS).toContain("archivedAt");
    expect(BASE_MODEL_TIMESTAMP_FIELDS).toContain("deletedAt");
  });
});

// =============================================================================
// Type Guards
// =============================================================================

describe("isBaseModel", () => {
  it("returns true for valid model", () => {
    expect(isBaseModel(validModel)).toBe(true);
  });

  it("returns true for full model", () => {
    expect(isBaseModel(fullModel)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isBaseModel(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isBaseModel(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isBaseModel("string")).toBe(false);
    expect(isBaseModel(123)).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isBaseModel({ id: "123" })).toBe(false);
    expect(isBaseModel({ ...validModel, id: undefined })).toBe(false);
    expect(isBaseModel({ ...validModel, model: undefined })).toBe(false);
  });

  it("returns false for wrong field types", () => {
    expect(isBaseModel({ ...validModel, id: 123 })).toBe(false);
    expect(isBaseModel({ ...validModel, createdAt: "2026-01-01" })).toBe(
      false,
    );
  });
});

describe("hasBaseModelShape", () => {
  it("returns true for minimal shape", () => {
    expect(hasBaseModelShape({ id: "123", model: "record" })).toBe(true);
  });

  it("returns true for full model", () => {
    expect(hasBaseModelShape(fullModel)).toBe(true);
  });

  it("returns false for null", () => {
    expect(hasBaseModelShape(null)).toBe(false);
  });

  it("returns false for missing id", () => {
    expect(hasBaseModelShape({ model: "record" })).toBe(false);
  });

  it("returns false for missing model", () => {
    expect(hasBaseModelShape({ id: "123" })).toBe(false);
  });
});

// =============================================================================
// Utility Functions
// =============================================================================

describe("createBaseModelInput", () => {
  it("creates input with required fields", () => {
    const input = createBaseModelInput({
      model: "record",
    });

    expect(input.model).toBe("record");
  });

  it("includes optional fields from overrides", () => {
    const input = createBaseModelInput({
      alias: "test",
      class: "memory",
      content: "Content",
      emoji: "🧪",
      model: "record",
      name: "Test",
      type: "document",
    });

    expect(input.alias).toBe("test");
    expect(input.class).toBe("memory");
    expect(input.content).toBe("Content");
    expect(input.emoji).toBe("🧪");
    expect(input.name).toBe("Test");
    expect(input.type).toBe("document");
  });

  it("does not include auto fields", () => {
    const input = createBaseModelInput({
      model: "record",
    }) as BaseModelInput & { id?: string };

    expect(input.id).toBeUndefined();
  });
});

describe("pickBaseModelFields", () => {
  it("extracts only BaseModel fields", () => {
    const obj = {
      ...fullModel,
      anotherExtra: 123,
      extraField: "should be removed",
    };

    const result = pickBaseModelFields(obj);

    expect(result.id).toBe(fullModel.id);
    expect(result.name).toBe(fullModel.name);
    expect(result.emoji).toBe(fullModel.emoji);
    expect((result as Record<string, unknown>).extraField).toBeUndefined();
    expect((result as Record<string, unknown>).anotherExtra).toBeUndefined();
  });

  it("handles partial objects", () => {
    const partial = { id: "123", name: "Test" };
    const result = pickBaseModelFields(partial as Partial<BaseModel>);

    expect(result.id).toBe("123");
    expect(result.name).toBe("Test");
    expect(result.model).toBeUndefined();
  });
});

describe("isTimestampField", () => {
  it("returns true for timestamp fields", () => {
    expect(isTimestampField("createdAt")).toBe(true);
    expect(isTimestampField("updatedAt")).toBe(true);
    expect(isTimestampField("archivedAt")).toBe(true);
    expect(isTimestampField("deletedAt")).toBe(true);
  });

  it("returns false for non-timestamp fields", () => {
    expect(isTimestampField("id")).toBe(false);
    expect(isTimestampField("name")).toBe(false);
    expect(isTimestampField("content")).toBe(false);
  });
});

describe("isAutoField", () => {
  it("returns true for auto fields", () => {
    expect(isAutoField("id")).toBe(true);
    expect(isAutoField("createdAt")).toBe(true);
    expect(isAutoField("updatedAt")).toBe(true);
    expect(isAutoField("history")).toBe(true);
  });

  it("returns false for user-provided fields", () => {
    expect(isAutoField("name")).toBe(false);
    expect(isAutoField("content")).toBe(false);
    expect(isAutoField("alias")).toBe(false);
  });
});

// =============================================================================
// Extended Model Types
// =============================================================================

describe("MessageModel type", () => {
  it("extends BaseModel with required content", () => {
    const message: MessageModel = {
      content: "Hello, world!",
      createdAt: new Date("2026-01-01"),
      id: "msg-123",
      model: "message",
      updatedAt: new Date("2026-01-01"),
    };

    expect(message.content).toBe("Hello, world!");
    expect(message.model).toBe("message");
  });

  it("supports optional type field", () => {
    const message: MessageModel = {
      content: "Hello from assistant",
      createdAt: new Date("2026-01-01"),
      id: "msg-123",
      model: "message",
      type: "assistant",
      updatedAt: new Date("2026-01-01"),
    };

    expect(message.type).toBe("assistant");
  });
});

describe("Progress type", () => {
  it("allows all optional fields", () => {
    const progress: Progress = {};
    expect(progress.elapsedTime).toBeUndefined();
    expect(progress.estimatedTime).toBeUndefined();
    expect(progress.percentageComplete).toBeUndefined();
    expect(progress.nextPercentageCheckpoint).toBeUndefined();
  });

  it("supports all progress fields", () => {
    const progress: Progress = {
      elapsedTime: 5000,
      estimatedTime: 10000,
      nextPercentageCheckpoint: 75,
      percentageComplete: 50,
    };

    expect(progress.elapsedTime).toBe(5000);
    expect(progress.estimatedTime).toBe(10000);
    expect(progress.percentageComplete).toBe(50);
    expect(progress.nextPercentageCheckpoint).toBe(75);
  });
});

describe("JobModel type", () => {
  it("extends BaseModel with required status", () => {
    const job: JobModel = {
      createdAt: new Date("2026-01-01"),
      id: "job-123",
      model: "job",
      status: "pending",
      updatedAt: new Date("2026-01-01"),
    };

    expect(job.status).toBe("pending");
    expect(job.model).toBe("job");
  });

  it("supports all job-specific fields", () => {
    const job: JobModel = {
      class: "evaluation",
      completedAt: new Date("2026-01-02"),
      createdAt: new Date("2026-01-01"),
      id: "job-123",
      messages: [
        {
          content: "Job started",
          createdAt: new Date("2026-01-01"),
          id: "msg-1",
          model: "message",
          type: "system",
          updatedAt: new Date("2026-01-01"),
        },
      ],
      model: "job",
      progress: {
        elapsedTime: 5000,
        estimatedTime: 10000,
        nextPercentageCheckpoint: 75,
        percentageComplete: 50,
      },
      startedAt: new Date("2026-01-01"),
      status: "processing",
      type: "batch",
      updatedAt: new Date("2026-01-02"),
    };

    expect(job.class).toBe("evaluation");
    expect(job.completedAt).toEqual(new Date("2026-01-02"));
    expect(job.messages).toHaveLength(1);
    expect(job.messages?.[0].content).toBe("Job started");
    expect(job.progress?.percentageComplete).toBe(50);
    expect(job.startedAt).toEqual(new Date("2026-01-01"));
    expect(job.status).toBe("processing");
    expect(job.type).toBe("batch");
  });
});
