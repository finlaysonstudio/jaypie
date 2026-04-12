/**
 * fabricIndex — model-keyed GSI factory
 *
 * Produces the canonical Jaypie single-table GSI shape:
 *
 *   pk: ["model"] or ["model", field]
 *   sk: ["scope", "updatedAt"]
 *
 * Partition by model (plus an optional second field like `alias` or `xid`),
 * sort by scope-and-timestamp. Query with `begins_with` on the sk composite
 * to filter by scope; omit the prefix to list across all scopes.
 */

import type { IndexDefinition } from "./types.js";

function capitalize(field: string): string {
  if (field.length === 0) return field;
  return field.charAt(0).toUpperCase() + field.slice(1);
}

/**
 * Build an IndexDefinition for the model-keyed / scope-sequence pattern.
 *
 * @param field - Optional second partition-key field (e.g., "alias", "xid",
 *   "category", or any custom field). When omitted, pk = ["model"] and the
 *   index spans every entity of the model.
 * @returns A fully-formed IndexDefinition ready to hand to `registerModel`.
 *
 * @example
 *   registerModel({
 *     model: "note",
 *     indexes: [
 *       fabricIndex(),           // indexModel
 *       fabricIndex("alias"),    // indexModelAlias (sparse)
 *       fabricIndex("xid"),      // indexModelXid (sparse)
 *     ],
 *   });
 */
export function fabricIndex(field?: string): IndexDefinition {
  if (!field) {
    return {
      name: "indexModel",
      pk: ["model"],
      sk: ["scope", "updatedAt"],
    };
  }
  return {
    name: `indexModel${capitalize(field)}`,
    pk: ["model", field],
    sk: ["scope", "updatedAt"],
    sparse: true,
  };
}
