/**
 * Meta-modeling Constants
 */

// =============================================================================
// Constants
// =============================================================================

/** Root organizational unit */
export const APEX = "@";

/** Fabric version - used to identify pre-instantiated Services */
export const FABRIC_VERSION = "0.1.0";

/** Composite key separator */
export const SEPARATOR = "#";

/** System-level models that describe other models */
export const SYSTEM_MODELS = ["context", "field", "model"] as const;

// =============================================================================
// Types
// =============================================================================

export type SystemModel = (typeof SYSTEM_MODELS)[number];
