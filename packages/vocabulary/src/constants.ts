/**
 * Meta-modeling Constants
 */

// =============================================================================
// Constants
// =============================================================================

/** Root organizational unit */
export const APEX = "@";

/** Composite key separator */
export const SEPARATOR = "#";

/** System-level models that describe other models */
export const SYSTEM_MODELS = ["context", "field", "model"] as const;

// =============================================================================
// Types
// =============================================================================

export type SystemModel = (typeof SYSTEM_MODELS)[number];
