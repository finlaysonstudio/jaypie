/**
 * BaseEntity - Core entity vocabulary for @jaypie/vocabulary
 *
 * Defines the standard fields and structure for all vocabulary entities.
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
// BaseEntity
// =============================================================================

/**
 * BaseEntity - Base type for all vocabulary entities
 *
 * All fields are part of the standard vocabulary for high reuse.
 * Optional fields may be omitted when not applicable.
 *
 * Field Groups:
 * - Identity (required): id, name
 * - Identity (optional): label, abbreviation, alias, xid, description
 * - Schema: model, class
 * - Content: content, metadata
 * - Display: emoji, icon
 * - Time: createdAt, updatedAt, archivedAt, deletedAt
 * - History: history
 */
export interface BaseEntity {
  // -------------------------------------------------------------------------
  // Identity (required)
  // -------------------------------------------------------------------------

  /** UUID - unique identifier */
  id: string;

  /** Full name, first reference (e.g., "December 12, 2026 Session") */
  name: string;

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

  /** External identifier for machine lookup (e.g., file path, external UUID) */
  xid?: string;

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  /** Varies by model (e.g., "memory", "reflection", "session") */
  class: string;

  /** Schema reference (e.g., "record", "job", "person") */
  model: string;

  // -------------------------------------------------------------------------
  // Content
  // -------------------------------------------------------------------------

  /** The actual content */
  content: string;

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
// Input/Update/Filter Types
// =============================================================================

/**
 * Input for creating a new BaseEntity
 * Omits auto-generated fields: id, createdAt, updatedAt, history
 */
export type BaseEntityInput = Omit<
  BaseEntity,
  "createdAt" | "history" | "id" | "updatedAt"
>;

/**
 * Partial input for updating a BaseEntity
 * History is managed automatically by the store
 */
export type BaseEntityUpdate = Partial<
  Omit<BaseEntity, "createdAt" | "history" | "id">
>;

/**
 * Filter options for listing entities
 */
export interface BaseEntityFilter {
  alias?: string;
  class?: string;
  model?: string;
  xid?: string;
}

// =============================================================================
// Field Name Constants
// =============================================================================

/**
 * BaseEntity field names as constants
 * Useful for building queries, validation, and serialization
 */
export const BASE_ENTITY_FIELDS = {
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
  XID: "xid",

  // Identity (required)
  ID: "id",
  NAME: "name",

  // Schema
  CLASS: "class",
  MODEL: "model",

  // Time
  ARCHIVED_AT: "archivedAt",
  CREATED_AT: "createdAt",
  DELETED_AT: "deletedAt",
  UPDATED_AT: "updatedAt",
} as const;

/**
 * Required fields for BaseEntity
 */
export const BASE_ENTITY_REQUIRED_FIELDS = [
  BASE_ENTITY_FIELDS.CLASS,
  BASE_ENTITY_FIELDS.CONTENT,
  BASE_ENTITY_FIELDS.CREATED_AT,
  BASE_ENTITY_FIELDS.ID,
  BASE_ENTITY_FIELDS.MODEL,
  BASE_ENTITY_FIELDS.NAME,
  BASE_ENTITY_FIELDS.UPDATED_AT,
] as const;

/**
 * Auto-generated fields (set by store, not by user)
 */
export const BASE_ENTITY_AUTO_FIELDS = [
  BASE_ENTITY_FIELDS.CREATED_AT,
  BASE_ENTITY_FIELDS.HISTORY,
  BASE_ENTITY_FIELDS.ID,
  BASE_ENTITY_FIELDS.UPDATED_AT,
] as const;

/**
 * Timestamp fields
 */
export const BASE_ENTITY_TIMESTAMP_FIELDS = [
  BASE_ENTITY_FIELDS.ARCHIVED_AT,
  BASE_ENTITY_FIELDS.CREATED_AT,
  BASE_ENTITY_FIELDS.DELETED_AT,
  BASE_ENTITY_FIELDS.UPDATED_AT,
] as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a BaseEntity
 */
export function isBaseEntity(value: unknown): value is BaseEntity {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.class === "string" &&
    typeof obj.content === "string" &&
    obj.createdAt instanceof Date &&
    typeof obj.id === "string" &&
    typeof obj.model === "string" &&
    typeof obj.name === "string" &&
    obj.updatedAt instanceof Date
  );
}

/**
 * Check if a value has the minimum BaseEntity shape (for partial objects)
 */
export function hasBaseEntityShape(value: unknown): boolean {
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
 * Create a minimal BaseEntityInput with required fields
 */
export function createBaseEntityInput(
  overrides: Partial<BaseEntityInput> & {
    class: string;
    content: string;
    model: string;
    name: string;
  },
): BaseEntityInput {
  return {
    ...overrides,
  };
}

/**
 * Extract only BaseEntity fields from an object
 * Useful for sanitizing input or preparing for storage
 */
export function pickBaseEntityFields<T extends Partial<BaseEntity>>(
  obj: T,
): Partial<BaseEntity> {
  const fields = Object.values(BASE_ENTITY_FIELDS);
  const result: Partial<BaseEntity> = {};

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
): field is (typeof BASE_ENTITY_TIMESTAMP_FIELDS)[number] {
  return (BASE_ENTITY_TIMESTAMP_FIELDS as readonly string[]).includes(field);
}

/**
 * Check if a field name is auto-generated
 */
export function isAutoField(
  field: string,
): field is (typeof BASE_ENTITY_AUTO_FIELDS)[number] {
  return (BASE_ENTITY_AUTO_FIELDS as readonly string[]).includes(field);
}
