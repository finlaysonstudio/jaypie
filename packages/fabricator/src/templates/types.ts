/**
 * Template structure for temporal weight distributions
 * Used for distributing events across time periods
 */
export interface TemporalTemplate {
  /**
   * Monthly weights (1-12 or month names)
   * Example: { 6: 1, 7: 1, 8: 1 } for summer only
   * Example: { january: 0.6, february: 0.6, december: 0.6 } for winter lull
   */
  months?: Record<number | string, number>;

  /**
   * ISO week weights (1-53)
   * Week 1 contains the first Thursday of the year
   */
  weeks?: Record<number, number>;

  /**
   * Day of week weights
   * Numbers: 0-6 where 0=Sunday
   * Strings: 'sunday', 'monday', etc.
   */
  days?: Record<number | string, number>;

  /**
   * Day of month weights (1-31)
   * Example: { 15: 4, 25: 1 } for billing on 15th and 25th
   */
  dates?: Record<number, number>;

  /**
   * Hour weights (0-23)
   * Example: { 8: 1, 9: 1, ..., 17: 1 } for business hours
   */
  hours?: Record<number, number>;

  /**
   * Indicates this is a curve template (multiplicative only)
   *
   * When true:
   * - Template only modifies weights that already exist
   * - Never creates new time slots
   * - Used for shaping distributions (peaks, curves)
   *
   * When false (default):
   * - Template defines which time slots are active
   * - Creates the base distribution
   */
  isCurve?: boolean;
}

/**
 * Month name to number mapping
 */
export const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Day name to number mapping (Sunday = 0)
 */
export const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
