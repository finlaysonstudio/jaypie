/**
 * FabricModel - Core model vocabulary for @jaypie/fabric
 *
 * Defines the standard fields and structure for all fabric models.
 * Provides a consistent, reusable vocabulary across applications.
 */

// =============================================================================
// History
// =============================================================================

/**
 * FabricHistoryEntry - Reverse delta recording previous values of changed fields
 *
 * Stores the previous state of fields before an update was applied.
 * Walk backwards through history to reconstruct earlier versions.
 */
export interface FabricHistoryEntry {
  /** Previous values of fields that were changed */
  delta: Record<string, unknown>;
  /** When this change was recorded (the updatedAt from before the change) */
  timestamp: Date;
}

// =============================================================================
// FabricModel
// =============================================================================

/**
 * FabricModel - Base type for all fabric models
 *
 * All fields are part of the standard vocabulary for high reuse.
 * Optional fields may be omitted when not applicable.
 *
 * Field Groups:
 * - Identity (required): id
 * - Identity (optional): name, label, abbreviation, alias, xid, description
 * - Schema: model, category, type
 * - Content: content, metadata
 * - Display: emoji, icon
 * - Time: createdAt, updatedAt, archivedAt, deletedAt
 * - History: history
 */
export interface FabricModel {
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
  category?: string;

  /** Schema reference (e.g., "record", "job", "person") */
  model: string;

  /** Varies by model (e.g., "assistant", "user", "system") */
  type?: string;

  // -------------------------------------------------------------------------
  // Storage (optional - only when persisted to DynamoDB)
  // -------------------------------------------------------------------------

  /** Scope: APEX ("@") or "{parent.model}#{parent.id}" */
  scope?: string;

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
  history?: FabricHistoryEntry[];
}

// =============================================================================
// FabricMessage
// =============================================================================

/**
 * FabricMessage - A message model that extends FabricModel
 *
 * Used for chat messages, notifications, logs, and other content-focused models.
 * The content field contains the actual message text.
 */
export interface FabricMessage extends FabricModel {
  /** The actual message content (inherited from FabricModel) */
  content: string;

  /** Message type (e.g., "assistant", "user", "system") */
  type?: string;
}

// =============================================================================
// FabricProgress
// =============================================================================

/**
 * FabricProgress - Tracks job execution progress
 */
export interface FabricProgress {
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
// FabricJob
// =============================================================================

/**
 * FabricJob - A job model that extends FabricModel
 *
 * Used for tracking asynchronous tasks, background processes, and batch operations.
 */
export interface FabricJob extends FabricModel {
  /** Job category (e.g., "evaluation", "export", "import") */
  category?: string;

  /** When the job finished (success or failure) */
  completedAt?: Date | null;

  /** Messages generated during job execution */
  messages?: FabricMessage[];

  /** Job execution progress */
  progress?: FabricProgress;

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
 * Input for creating a new FabricModel
 * Omits auto-generated fields: id, createdAt, updatedAt, history
 */
export type FabricModelInput = Omit<
  FabricModel,
  "createdAt" | "history" | "id" | "updatedAt"
>;

/**
 * Partial input for updating a FabricModel
 * History is managed automatically by the store
 */
export type FabricModelUpdate = Partial<
  Omit<FabricModel, "createdAt" | "history" | "id">
>;

/**
 * Filter options for listing models
 */
export interface FabricModelFilter {
  alias?: string;
  category?: string;
  model?: string;
  type?: string;
  xid?: string;
}

// =============================================================================
// Field Name Constants
// =============================================================================

/**
 * FabricModel field names as constants
 * Useful for building queries, validation, and serialization
 */
export const FABRIC_MODEL_FIELDS = {
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
  CATEGORY: "category",
  MODEL: "model",
  TYPE: "type",

  // Storage
  SCOPE: "scope",
  SEQUENCE: "sequence",

  // Time
  ARCHIVED_AT: "archivedAt",
  CREATED_AT: "createdAt",
  DELETED_AT: "deletedAt",
  UPDATED_AT: "updatedAt",
} as const;

/**
 * Required fields for FabricModel
 */
export const FABRIC_MODEL_REQUIRED_FIELDS = [
  FABRIC_MODEL_FIELDS.CREATED_AT,
  FABRIC_MODEL_FIELDS.ID,
  FABRIC_MODEL_FIELDS.MODEL,
  FABRIC_MODEL_FIELDS.UPDATED_AT,
] as const;

/**
 * Auto-generated fields (set by store, not by user)
 */
export const FABRIC_MODEL_AUTO_FIELDS = [
  FABRIC_MODEL_FIELDS.CREATED_AT,
  FABRIC_MODEL_FIELDS.HISTORY,
  FABRIC_MODEL_FIELDS.ID,
  FABRIC_MODEL_FIELDS.UPDATED_AT,
] as const;

/**
 * Timestamp fields
 */
export const FABRIC_MODEL_TIMESTAMP_FIELDS = [
  FABRIC_MODEL_FIELDS.ARCHIVED_AT,
  FABRIC_MODEL_FIELDS.CREATED_AT,
  FABRIC_MODEL_FIELDS.DELETED_AT,
  FABRIC_MODEL_FIELDS.UPDATED_AT,
] as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a FabricModel
 */
export function isFabricModel(value: unknown): value is FabricModel {
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
 * Check if a value has the minimum FabricModel shape (for partial objects)
 */
export function hasFabricModelShape(value: unknown): boolean {
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
 * Create a minimal FabricModelInput with required fields
 */
export function createFabricModelInput(
  overrides: Partial<FabricModelInput> & {
    model: string;
  },
): FabricModelInput {
  return {
    ...overrides,
  };
}

/**
 * Extract only FabricModel fields from an object
 * Useful for sanitizing input or preparing for storage
 */
export function pickFabricModelFields<T extends Partial<FabricModel>>(
  obj: T,
): Partial<FabricModel> {
  const fields = Object.values(FABRIC_MODEL_FIELDS);
  const result: Partial<FabricModel> = {};

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
): field is (typeof FABRIC_MODEL_TIMESTAMP_FIELDS)[number] {
  return (FABRIC_MODEL_TIMESTAMP_FIELDS as readonly string[]).includes(field);
}

/**
 * Check if a field name is auto-generated
 */
export function isAutoField(
  field: string,
): field is (typeof FABRIC_MODEL_AUTO_FIELDS)[number] {
  return (FABRIC_MODEL_AUTO_FIELDS as readonly string[]).includes(field);
}
