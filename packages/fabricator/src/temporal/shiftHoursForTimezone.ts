/**
 * Shifts hour weights based on timezone offset
 *
 * Converts hour weights from one timezone to UTC by applying the offset.
 * For example, if a merchant operates 8am-6pm in America/New_York (UTC-5),
 * the hour weights are shifted to represent 13:00-23:00 UTC.
 *
 * @param config.hours - Hour weights in the merchant's local timezone
 * @param config.timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Hour weights shifted to UTC
 *
 * @example
 * // Business hours 9am-5pm in New York (UTC-5 in winter)
 * const localHours = { 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 };
 * const utcHours = shiftHoursForTimezone({
 *   hours: localHours,
 *   timezone: 'America/New_York'
 * });
 * // Result: { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1 }
 */
export function shiftHoursForTimezone({
  hours,
  timezone,
}: {
  hours: Record<number, number>;
  timezone: string;
}): Record<number, number> {
  // Get the timezone offset in hours
  // We use a reference date to calculate the offset
  // Note: This is a simplified approach - for production, consider using a library like date-fns-tz
  const referenceDate = new Date("2024-01-15T12:00:00Z"); // Mid-January to avoid DST edge cases
  const utcDate = new Date(
    referenceDate.toLocaleString("en-US", { timeZone: "UTC" }),
  );
  const tzDate = new Date(
    referenceDate.toLocaleString("en-US", { timeZone: timezone }),
  );
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));

  const shifted: Record<number, number> = {};
  for (const [hourStr, weight] of Object.entries(hours)) {
    const hour = Number(hourStr);
    const shiftedHour = (hour + offsetHours + 24) % 24; // Add 24 to handle negative offsets
    shifted[shiftedHour] = weight;
  }

  return shifted;
}
