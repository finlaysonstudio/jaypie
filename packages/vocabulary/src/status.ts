/**
 * Status Type for @jaypie/vocabulary
 *
 * Standard status values for fields that track processing state.
 */

/**
 * Valid status values for status fields
 */
export const STATUS_VALUES = [
  "canceled",
  "complete",
  "error",
  "pending",
  "processing",
  "queued",
  "sending",
] as const;

/**
 * TypeScript type for status values
 */
export type Status = (typeof STATUS_VALUES)[number];

/**
 * Status type for use in serviceHandler input definitions
 *
 * Usage:
 * ```typescript
 * const handler = serviceHandler({
 *   input: {
 *     status: { type: StatusType, description: "Current status" },
 *   },
 * });
 * ```
 */
export const StatusType = [...STATUS_VALUES] as (
  | "canceled"
  | "complete"
  | "error"
  | "pending"
  | "processing"
  | "queued"
  | "sending"
)[];

/**
 * Check if a value is a valid status
 */
export function isStatus(value: unknown): value is Status {
  return (
    typeof value === "string" &&
    STATUS_VALUES.includes(value as (typeof STATUS_VALUES)[number])
  );
}
