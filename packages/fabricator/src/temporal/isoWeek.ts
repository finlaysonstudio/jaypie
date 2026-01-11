/**
 * Gets the ISO 8601 week number for a date
 *
 * ISO 8601 week date system:
 * - Week 1 is the first week with a Thursday in it (or equivalently, the week containing January 4th)
 * - Weeks start on Monday (day 1) and end on Sunday (day 7)
 * - Each week belongs to the year that contains its Thursday
 * - Some years have 53 weeks (long years), most have 52
 *
 * @param date - The date to get the week number for
 * @returns The ISO week number (1-53)
 */
export function getISOWeekNumber(date: Date): number {
  // Create a copy of the date in UTC to avoid timezone issues
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // Convert Sunday (0) to 7 for ISO week calculation (Monday = 1, Sunday = 7)
  const dayOfWeek = d.getUTCDay() || 7;

  // Move to Thursday of the current week (ISO weeks are defined by their Thursday)
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);

  // Get the year that contains this Thursday
  const yearOfThursday = d.getUTCFullYear();

  // Get January 1st of that year
  const yearStart = new Date(Date.UTC(yearOfThursday, 0, 1));

  // Calculate the number of days between yearStart and the Thursday
  const daysSinceYearStart = (d.getTime() - yearStart.getTime()) / 86400000 + 1;

  // Calculate the week number
  return Math.ceil(daysSinceYearStart / 7);
}
