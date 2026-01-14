/**
 * BaseModel - Core model vocabulary for @jaypie/fabric
 *
 * Defines the standard fields and structure for all fabric models.
 * Provides a consistent, reusable vocabulary across applications.
 */

// =============================================================================
// History
// =============================================================================

/**
 * HistoryEntry - Reverse delta recording previous values of changed fields
 *
 * Stores the previous state of fields before an update was applied.
 * Walk backwards through history to reconstruct earlier versions.
 */
export interface HistoryEntry {
  /** Previous values of fields that were changed */
  delta: Record<string, unknown>;
  /** When this change was recorded (the updatedAt from before the change) */
  timestamp: Date;
}

// =============================================================================
// BaseModel
// =============================================================================

/**
 * BaseModel - Base type for all fabric models
 *
 * All fields are part of the standard vocabulary for high reuse.
 * Optional fields may be omitted when not applicable.
 *
 * Field Groups:
 * - Identity (required): id
 * - Identity (optional): name, label, abbreviation, alias, xid, description
 * - Schema: model, class, type
 * - Content: content, metadata
 * - Display: emoji, icon
 * - Time: createdAt, updatedAt, archivedAt, deletedAt
 * - History: history
 */
export interface BaseModel {
  // -------------------------------------------------------------------------
  // Identity (required)
  // -------------------------------------------------------------------------

  /** UUID - unique identifier */
  id: string;

  // -------------------------------------------------------------------------
  // Identity (optional)
  // -------------------------------------------------------------------------

  /** Shortest form, even imprecise (e.g., "12/12") */
  abbreviation?: string;

  /** Slug/key for human lookup (e.g., "2026-12-12", "my-project") */
  alias?: string;

  /** What this entity is about */
  description?: string;

  /** Short name, second reference (e.g., "December 12") */
  label?: string;

  /** Full name, first reference (e.g., "December 12, 2026 Session") */
  name?: string;

  /** External identifier for machine lookup (e.g., file path, external UUID) */
  xid?: string;

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  /** Varies by model (e.g., "memory", "reflection", "session") */
  class?: string;

  /** Schema reference (e.g., "record", "job", "person") */
  model: string;

  /** Varies by model (e.g., "assistant", "user", "system") */
  type?: string;

  // -------------------------------------------------------------------------
  // Storage (optional - only when persisted to DynamoDB)
  // -------------------------------------------------------------------------

  /** Organizational unit: APEX ("@") or "{parent.model}#{parent.id}" */
  ou?: string;

  /** Timestamp for chronological ordering (Date.now()) */
  sequence?: number;

  // -------------------------------------------------------------------------
  // Content
  // -------------------------------------------------------------------------

  /** The actual content */
  content?: string;

  /** Extensible data */
  metadata?: Record<string, unknown>;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Emoji representation */
  emoji?: string;

  /** Icon identifier (e.g., Lucide icon name) */
  icon?: string;

  // -------------------------------------------------------------------------
  // Time
  // -------------------------------------------------------------------------

  /** Archived timestamp (hidden but recoverable) */
  archivedAt?: Date | null;

  /** Creation timestamp */
  createdAt: Date;

  /** Soft delete timestamp */
  deletedAt?: Date | null;

  /** Last modified timestamp */
  updatedAt: Date;

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  /** Reverse deltas tracking changes over time */
  history?: HistoryEntry[];
}

// =============================================================================
// MessageModel
// =============================================================================

/**
 * MessageModel - A message model that extends BaseModel
 *
 * Used for chat messages, notifications, logs, and other content-focused models.
 * The content field contains the actual message text.
 */
export interface MessageModel extends BaseModel {
  /** The actual message content (inherited from BaseModel) */
  content: string;

  /** Message type (e.g., "assistant", "user", "system") */
  type?: string;
}

// =============================================================================
// Progress
// =============================================================================

/**
 * Progress - Tracks job execution progress
 */
export interface Progress {
  /** Time elapsed in milliseconds */
  elapsedTime?: number;

  /** Estimated total time in milliseconds */
  estimatedTime?: number;

  /** Next percentage milestone to report (e.g., 25, 50, 75, 100) */
  nextPercentageCheckpoint?: number;

  /** Current completion percentage (0-100) */
  percentageComplete?: number;
}

// =============================================================================
// JobModel
// =============================================================================

/**
 * JobModel - A job model that extends BaseModel
 *
 * Used for tracking asynchronous tasks, background processes, and batch operations.
 */
export interface JobModel extends BaseModel {
  /** Job class (e.g., "evaluation", "export", "import") */
  class?: string;

  /** When the job finished (success or failure) */
  completedAt?: Date | null;

  /** Messages generated during job execution */
  messages?: MessageModel[];

  /** Job execution progress */
  progress?: Progress;

  /** When the job started processing */
  startedAt?: Date | null;

  /** Current job status */
  status: string;

  /** Job type (e.g., "batch", "realtime", "scheduled") */
  type?: string;
}

// =============================================================================
// Input/Update/Filter Types
// =============================================================================

/**
 * Input for creating a new BaseModel
 * Omits auto-generated fields: id, createdAt, updatedAt, history
 */
export type BaseModelInput = Omit<
  BaseModel,
  "createdAt" | "history" | "id" | "updatedAt"
>;

/**
 * Partial input for updating a BaseModel
 * History is managed automatically by the store
 */
export type BaseModelUpdate = Partial<
  Omit<BaseModel, "createdAt" | "history" | "id">
>;

/**
 * Filter options for listing models
 */
export interface BaseModelFilter {
  alias?: string;
  class?: string;
  model?: string;
  type?: string;
  xid?: string;
}

// =============================================================================
// Field Name Constants
// =============================================================================

/**
 * BaseModel field names as constants
 * Useful for building queries, validation, and serialization
 */
export const BASE_MODEL_FIELDS = {
  // Content
  CONTENT: "content",
  METADATA: "metadata",

  // Display
  EMOJI: "emoji",
  ICON: "icon",

  // History
  HISTORY: "history",

  // Identity (optional)
  ABBREVIATION: "abbreviation",
  ALIAS: "alias",
  DESCRIPTION: "description",
  LABEL: "label",
  NAME: "name",
  XID: "xid",

  // Identity (required)
  ID: "id",

  // Schema
  CLASS: "class",
  MODEL: "model",
  TYPE: "type",

  // Storage
  OU: "ou",
  SEQUENCE: "sequence",

  // Time
  ARCHIVED_AT: "archivedAt",
  CREATED_AT: "createdAt",
  DELETED_AT: "deletedAt",
  UPDATED_AT: "updatedAt",
} as const;

/**
 * Required fields for BaseModel
 */
export const BASE_MODEL_REQUIRED_FIELDS = [
  BASE_MODEL_FIELDS.CREATED_AT,
  BASE_MODEL_FIELDS.ID,
  BASE_MODEL_FIELDS.MODEL,
  BASE_MODEL_FIELDS.UPDATED_AT,
] as const;

/**
 * Auto-generated fields (set by store, not by user)
 */
export const BASE_MODEL_AUTO_FIELDS = [
  BASE_MODEL_FIELDS.CREATED_AT,
  BASE_MODEL_FIELDS.HISTORY,
  BASE_MODEL_FIELDS.ID,
  BASE_MODEL_FIELDS.UPDATED_AT,
] as const;

/**
 * Timestamp fields
 */
export const BASE_MODEL_TIMESTAMP_FIELDS = [
  BASE_MODEL_FIELDS.ARCHIVED_AT,
  BASE_MODEL_FIELDS.CREATED_AT,
  BASE_MODEL_FIELDS.DELETED_AT,
  BASE_MODEL_FIELDS.UPDATED_AT,
] as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a BaseModel
 */
export function isBaseModel(value: unknown): value is BaseModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    obj.createdAt instanceof Date &&
    typeof obj.id === "string" &&
    typeof obj.model === "string" &&
    obj.updatedAt instanceof Date
  );
}

/**
 * Check if a value has the minimum BaseModel shape (for partial objects)
 */
export function hasBaseModelShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.model === "string";
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a minimal BaseModelInput with required fields
 */
export function createBaseModelInput(
  overrides: Partial<BaseModelInput> & {
    model: string;
  },
): BaseModelInput {
  return {
    ...overrides,
  };
}

/**
 * Extract only BaseModel fields from an object
 * Useful for sanitizing input or preparing for storage
 */
export function pickBaseModelFields<T extends Partial<BaseModel>>(
  obj: T,
): Partial<BaseModel> {
  const fields = Object.values(BASE_MODEL_FIELDS);
  const result: Partial<BaseModel> = {};

  for (const field of fields) {
    if (field in obj) {
      (result as Record<string, unknown>)[field] = (
        obj as Record<string, unknown>
      )[field];
    }
  }

  return result;
}

/**
 * Check if a field name is a timestamp field
 */
export function isTimestampField(
  field: string,
): field is (typeof BASE_MODEL_TIMESTAMP_FIELDS)[number] {
  return (BASE_MODEL_TIMESTAMP_FIELDS as readonly string[]).includes(field);
}

/**
 * Check if a field name is auto-generated
 */
export function isAutoField(
  field: string,
): field is (typeof BASE_MODEL_AUTO_FIELDS)[number] {
  return (BASE_MODEL_AUTO_FIELDS as readonly string[]).includes(field);
}
