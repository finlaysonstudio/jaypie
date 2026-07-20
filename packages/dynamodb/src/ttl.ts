import { BadRequestError } from "@jaypie/errors";
import log from "@jaypie/logger";

/**
 * Accepted TTL inputs:
 * - `number` — a future epoch time in **seconds** (the DynamoDB TTL format),
 *   used as-is (floored).
 * - duration string — e.g. `"1 day"`, `"4 weeks"`, `"1 month"`; resolved to
 *   `now + duration`.
 * - ISO 8601 date string — e.g. `"2026-07-20T04:59:16.368Z"`; resolved to that
 *   instant.
 */
export type TtlInput = number | string;

/** Seconds per duration unit. Month and year bias late (never early). */
const DURATION_SECONDS = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: 60 * 60 * 24 * 31,
  year: 60 * 60 * 24 * 366,
} as const;

const DURATION_PATTERN =
  /^(\d+)\s*(second|minute|hour|day|week|month|year)s?$/i;

/**
 * Resolve a TTL input to a DynamoDB TTL value: a Unix epoch in **seconds**.
 *
 * Detection order: a `number` is treated as epoch seconds; a string matching a
 * single-unit duration (`"30 days"`) resolves against now; otherwise the string
 * is parsed as an ISO 8601 date. Unparseable input throws `BadRequestError`.
 *
 * A resolved value that is not strictly in the future is still returned, but an
 * error is logged — a past TTL usually signals a mistake, yet DynamoDB will
 * simply expire the item on its next sweep.
 *
 * @param input - Epoch seconds, a duration string, or an ISO 8601 date string
 * @returns Unix epoch seconds (integer)
 * @throws BadRequestError when the input cannot be interpreted
 */
export function resolveTtl(input: TtlInput): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  let resolved: number;

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new BadRequestError(`Cannot parse ttl: ${String(input)}.`);
    }
    resolved = Math.floor(input);
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    const durationMatch = DURATION_PATTERN.exec(trimmed);
    if (durationMatch) {
      const amount = Number(durationMatch[1]);
      const unit =
        durationMatch[2].toLowerCase() as keyof typeof DURATION_SECONDS;
      resolved = nowSeconds + amount * DURATION_SECONDS[unit];
    } else {
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        throw new BadRequestError(
          `Cannot parse ttl: "${input}". Expected epoch seconds, a duration like "30 days", or an ISO 8601 date.`,
        );
      }
      resolved = Math.floor(parsed / 1000);
    }
  } else {
    throw new BadRequestError(
      `Cannot parse ttl: ${String(input)}. Expected a number, duration string, or ISO 8601 date.`,
    );
  }

  if (resolved <= nowSeconds) {
    log.error("[resolveTtl] Resolved TTL is not in the future");
    log.var({ input, now: nowSeconds, ttl: resolved });
  }

  return resolved;
}
