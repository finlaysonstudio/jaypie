/**
 * Gets all days in a year as an array of UTC dates
 *
 * @param year - The year to get days for
 * @returns Array of Date objects for each day (365 or 366)
 *
 * @example
 * const days = getDaysInYear(2025);
 * days.length; // 365
 * days[0];     // 2025-01-01T00:00:00.000Z
 * days[364];   // 2025-12-31T00:00:00.000Z
 */
export function getDaysInYear(year: number): Date[] {
  const days: Date[] = [];
  const startDate = new Date(Date.UTC(year, 0, 1)); // January 1st
  const endDate = new Date(Date.UTC(year + 1, 0, 1)); // January 1st of next year

  const currentDate = new Date(startDate);
  while (currentDate < endDate) {
    days.push(new Date(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return days;
}

/**
 * Generator version for memory-efficient iteration
 *
 * @param year - The year to iterate
 * @yields Date objects for each day in the year
 */
export function* iterateDaysInYear(
  year: number,
): Generator<Date, void, undefined> {
  const startDate = new Date(Date.UTC(year, 0, 1)); // January 1st
  const endDate = new Date(Date.UTC(year + 1, 0, 1)); // January 1st of next year

  const currentDate = new Date(startDate);
  while (currentDate < endDate) {
    yield new Date(currentDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
}
