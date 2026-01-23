/**
 * Tests for FabricModel types and utilities
 */

import { describe, expect, it } from "vitest";

import {
  createFabricModelInput,
  FABRIC_MODEL_AUTO_FIELDS,
  FABRIC_MODEL_FIELDS,
  FABRIC_MODEL_REQUIRED_FIELDS,
  FABRIC_MODEL_TIMESTAMP_FIELDS,
  hasFabricModelShape,
  isAutoField,
  isFabricModel,
  isTimestampField,
  pickFabricModelFields,
  type FabricJob,
  type FabricMessage,
  type FabricModel,
  type FabricModelInput,
  type FabricProgress,
} from "../models/base.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const validModel: FabricModel = {
  createdAt: new Date("2026-01-01"),
  id: "123e4567-e89b-12d3-a456-426614174000",
  model: "record",
  updatedAt: new Date("2026-01-01"),
};

const fullModel: FabricModel = {
  ...validModel,
  abbreviation: "T",
  alias: "test-model",
  archivedAt: null,
  category: "memory",
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

describe("FABRIC_MODEL_FIELDS", () => {
  it("contains all expected fields", () => {
    expect(FABRIC_MODEL_FIELDS.ID).toBe("id");
    expect(FABRIC_MODEL_FIELDS.MODEL).toBe("model");
    expect(FABRIC_MODEL_FIELDS.CREATED_AT).toBe("createdAt");
    expect(FABRIC_MODEL_FIELDS.UPDATED_AT).toBe("updatedAt");
  });

  it("contains schema fields", () => {
    expect(FABRIC_MODEL_FIELDS.CATEGORY).toBe("category");
    expect(FABRIC_MODEL_FIELDS.MODEL).toBe("model");
    expect(FABRIC_MODEL_FIELDS.TYPE).toBe("type");
  });

  it("contains optional identity fields", () => {
    expect(FABRIC_MODEL_FIELDS.ABBREVIATION).toBe("abbreviation");
    expect(FABRIC_MODEL_FIELDS.ALIAS).toBe("alias");
    expect(FABRIC_MODEL_FIELDS.DESCRIPTION).toBe("description");
    expect(FABRIC_MODEL_FIELDS.LABEL).toBe("label");
    expect(FABRIC_MODEL_FIELDS.NAME).toBe("name");
    expect(FABRIC_MODEL_FIELDS.XID).toBe("xid");
  });

  it("contains content fields", () => {
    expect(FABRIC_MODEL_FIELDS.CONTENT).toBe("content");
    expect(FABRIC_MODEL_FIELDS.METADATA).toBe("metadata");
  });

  it("contains display fields", () => {
    expect(FABRIC_MODEL_FIELDS.EMOJI).toBe("emoji");
    expect(FABRIC_MODEL_FIELDS.ICON).toBe("icon");
  });

  it("contains lifecycle fields", () => {
    expect(FABRIC_MODEL_FIELDS.ARCHIVED_AT).toBe("archivedAt");
    expect(FABRIC_MODEL_FIELDS.DELETED_AT).toBe("deletedAt");
    expect(FABRIC_MODEL_FIELDS.HISTORY).toBe("history");
  });
});

describe("FABRIC_MODEL_REQUIRED_FIELDS", () => {
  it("lists all required fields", () => {
    expect(FABRIC_MODEL_REQUIRED_FIELDS).toContain("id");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).toContain("model");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).toContain("createdAt");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).toContain("updatedAt");
  });

  it("does not include optional fields", () => {
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("category");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("content");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("label");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("alias");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("metadata");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("name");
    expect(FABRIC_MODEL_REQUIRED_FIELDS).not.toContain("type");
  });
});

describe("FABRIC_MODEL_AUTO_FIELDS", () => {
  it("lists auto-generated fields", () => {
    expect(FABRIC_MODEL_AUTO_FIELDS).toContain("id");
    expect(FABRIC_MODEL_AUTO_FIELDS).toContain("createdAt");
    expect(FABRIC_MODEL_AUTO_FIELDS).toContain("updatedAt");
    expect(FABRIC_MODEL_AUTO_FIELDS).toContain("history");
  });

  it("does not include user-provided fields", () => {
    expect(FABRIC_MODEL_AUTO_FIELDS).not.toContain("name");
    expect(FABRIC_MODEL_AUTO_FIELDS).not.toContain("content");
  });
});

describe("FABRIC_MODEL_TIMESTAMP_FIELDS", () => {
  it("lists all timestamp fields", () => {
    expect(FABRIC_MODEL_TIMESTAMP_FIELDS).toContain("createdAt");
    expect(FABRIC_MODEL_TIMESTAMP_FIELDS).toContain("updatedAt");
    expect(FABRIC_MODEL_TIMESTAMP_FIELDS).toContain("archivedAt");
    expect(FABRIC_MODEL_TIMESTAMP_FIELDS).toContain("deletedAt");
  });
});

// =============================================================================
// Type Guards
// =============================================================================

describe("isFabricModel", () => {
  it("returns true for valid model", () => {
    expect(isFabricModel(validModel)).toBe(true);
  });

  it("returns true for full model", () => {
    expect(isFabricModel(fullModel)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFabricModel(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFabricModel(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isFabricModel("string")).toBe(false);
    expect(isFabricModel(123)).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isFabricModel({ id: "123" })).toBe(false);
    expect(isFabricModel({ ...validModel, id: undefined })).toBe(false);
    expect(isFabricModel({ ...validModel, model: undefined })).toBe(false);
  });

  it("returns false for wrong field types", () => {
    expect(isFabricModel({ ...validModel, id: 123 })).toBe(false);
    expect(isFabricModel({ ...validModel, createdAt: "2026-01-01" })).toBe(
      false,
    );
  });
});

describe("hasFabricModelShape", () => {
  it("returns true for minimal shape", () => {
    expect(hasFabricModelShape({ id: "123", model: "record" })).toBe(true);
  });

  it("returns true for full model", () => {
    expect(hasFabricModelShape(fullModel)).toBe(true);
  });

  it("returns false for null", () => {
    expect(hasFabricModelShape(null)).toBe(false);
  });

  it("returns false for missing id", () => {
    expect(hasFabricModelShape({ model: "record" })).toBe(false);
  });

  it("returns false for missing model", () => {
    expect(hasFabricModelShape({ id: "123" })).toBe(false);
  });
});

// =============================================================================
// Utility Functions
// =============================================================================

describe("createFabricModelInput", () => {
  it("creates input with required fields", () => {
    const input = createFabricModelInput({
      model: "record",
    });

    expect(input.model).toBe("record");
  });

  it("includes optional fields from overrides", () => {
    const input = createFabricModelInput({
      alias: "test",
      category: "memory",
      content: "Content",
      emoji: "🧪",
      model: "record",
      name: "Test",
      type: "document",
    });

    expect(input.alias).toBe("test");
    expect(input.category).toBe("memory");
    expect(input.content).toBe("Content");
    expect(input.emoji).toBe("🧪");
    expect(input.name).toBe("Test");
    expect(input.type).toBe("document");
  });

  it("does not include auto fields", () => {
    const input = createFabricModelInput({
      model: "record",
    }) as FabricModelInput & { id?: string };

    expect(input.id).toBeUndefined();
  });
});

describe("pickFabricModelFields", () => {
  it("extracts only FabricModel fields", () => {
    const obj = {
      ...fullModel,
      anotherExtra: 123,
      extraField: "should be removed",
    };

    const result = pickFabricModelFields(obj);

    expect(result.id).toBe(fullModel.id);
    expect(result.name).toBe(fullModel.name);
    expect(result.emoji).toBe(fullModel.emoji);
    expect((result as Record<string, unknown>).extraField).toBeUndefined();
    expect((result as Record<string, unknown>).anotherExtra).toBeUndefined();
  });

  it("handles partial objects", () => {
    const partial = { id: "123", name: "Test" };
    const result = pickFabricModelFields(partial as Partial<FabricModel>);

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

describe("FabricMessage type", () => {
  it("extends FabricModel with required content", () => {
    const message: FabricMessage = {
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
    const message: FabricMessage = {
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

describe("FabricProgress type", () => {
  it("allows all optional fields", () => {
    const progress: FabricProgress = {};
    expect(progress.elapsedTime).toBeUndefined();
    expect(progress.estimatedTime).toBeUndefined();
    expect(progress.percentageComplete).toBeUndefined();
    expect(progress.nextPercentageCheckpoint).toBeUndefined();
  });

  it("supports all progress fields", () => {
    const progress: FabricProgress = {
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

describe("FabricJob type", () => {
  it("extends FabricModel with required status", () => {
    const job: FabricJob = {
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
    const job: FabricJob = {
      category: "evaluation",
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

    expect(job.category).toBe("evaluation");
    expect(job.completedAt).toEqual(new Date("2026-01-02"));
    expect(job.messages).toHaveLength(1);
    expect(job.messages?.[0].content).toBe("Job started");
    expect(job.progress?.percentageComplete).toBe(50);
    expect(job.startedAt).toEqual(new Date("2026-01-01"));
    expect(job.status).toBe("processing");
    expect(job.type).toBe("batch");
  });
});
