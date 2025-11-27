import type { TemporalTemplate } from "./types.js";

//
// Hour Templates
//

/** Business hours: 8am-5pm */
export const HOURS_BUSINESS: TemporalTemplate = {
  hours: { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 },
};

/** Extended hours: 6am-6pm */
export const HOURS_EXTENDED: TemporalTemplate = {
  hours: {
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
    11: 1,
    12: 1,
    13: 1,
    14: 1,
    15: 1,
    16: 1,
    17: 1,
    18: 1,
  },
};

/** Evening hours: 6pm-10pm */
export const HOURS_EVENING: TemporalTemplate = {
  hours: { 18: 1, 19: 1, 20: 1, 21: 1 },
};

/** Overnight hours: 10pm-6am */
export const HOURS_OVERNIGHT: TemporalTemplate = {
  hours: { 22: 1, 23: 1, 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
};

/** Limited hours: 10am-2pm */
export const HOURS_LIMITED: TemporalTemplate = {
  hours: { 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 },
};

/** Early hours: 6am-2pm */
export const HOURS_EARLY: TemporalTemplate = {
  hours: { 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 },
};

/** Retail hours: 10am-8pm */
export const HOURS_RETAIL: TemporalTemplate = {
  hours: {
    10: 1,
    11: 1,
    12: 1,
    13: 1,
    14: 1,
    15: 1,
    16: 1,
    17: 1,
    18: 1,
    19: 1,
    20: 1,
  },
};

/** Afternoon/evening: 11am-10pm */
export const HOURS_AFTERNOON_EVENING: TemporalTemplate = {
  hours: {
    11: 1,
    12: 1,
    13: 1,
    14: 1,
    15: 1,
    16: 1,
    17: 1,
    18: 1,
    19: 1,
    20: 1,
    21: 1,
    22: 1,
  },
};

/** 24/7 - all hours equal */
export const HOURS_24_7: TemporalTemplate = {
  hours: {
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
    11: 1,
    12: 1,
    13: 1,
    14: 1,
    15: 1,
    16: 1,
    17: 1,
    18: 1,
    19: 1,
    20: 1,
    21: 1,
    22: 1,
    23: 1,
  },
};

/** Weekend daytime: 10am-5pm */
export const HOURS_WEEKEND: TemporalTemplate = {
  hours: { 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 },
};

//
// Day Templates
//

/** Weekdays only (Mon-Fri) */
export const DAYS_WEEKDAYS_ONLY: TemporalTemplate = {
  days: {
    monday: 1,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1,
    saturday: 0,
    sunday: 0,
  },
};

/** No Sunday */
export const DAYS_NO_SUNDAY: TemporalTemplate = {
  days: {
    monday: 1,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1,
    saturday: 1,
    sunday: 0,
  },
};

/** No Monday */
export const DAYS_NO_MONDAY: TemporalTemplate = {
  days: {
    sunday: 1,
    monday: 0,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1,
    saturday: 1,
  },
};

/** No Sunday or Monday (Tue-Sat) */
export const DAYS_NO_SUNDAY_MONDAY: TemporalTemplate = {
  days: {
    sunday: 0,
    monday: 0,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1,
    saturday: 1,
  },
};

//
// Date Templates
//

/** 15th and 25th of month (billing cycles) */
export const DATES_15_AND_25: TemporalTemplate = {
  dates: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 4,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    22: 0,
    23: 0,
    24: 0,
    25: 1,
    26: 0,
    27: 0,
    28: 0,
    29: 0,
    30: 0,
    31: 0,
  },
  hours: { 3: 1, 4: 1, 5: 1, 6: 1 }, // Early morning batch processing
};

//
// Seasonal Templates
//

/** Summer only: June-August */
export const SEASON_SUMMER_ONLY: TemporalTemplate = {
  months: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 1,
    7: 1,
    8: 1,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
  },
};

/** Winter only: December-February */
export const SEASON_WINTER_ONLY: TemporalTemplate = {
  months: {
    1: 1,
    2: 1,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 1,
  },
};

/** Exclude summer */
export const SEASON_NO_SUMMER: TemporalTemplate = {
  months: {
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 0,
    7: 0,
    8: 0,
    9: 1,
    10: 1,
    11: 1,
    12: 1,
  },
};

/** Exclude winter */
export const SEASON_NO_WINTER: TemporalTemplate = {
  months: {
    1: 0,
    2: 0,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
    11: 1,
    12: 0,
  },
};

//
// Curve Templates (Multiplicative)
//

/** Evening peak pattern - peaks at 7pm */
export const CURVE_EVENING_PEAK: TemporalTemplate = {
  hours: {
    0: 0.1,
    1: 0.08,
    2: 0.07,
    3: 0.06,
    4: 0.06,
    5: 0.1,
    6: 0.18,
    7: 0.3,
    8: 0.45,
    9: 0.6,
    10: 0.7,
    11: 0.75,
    12: 0.82,
    13: 0.85,
    14: 0.75,
    15: 0.68,
    16: 0.65,
    17: 0.78,
    18: 0.9,
    19: 1.0,
    20: 0.92,
    21: 0.8,
    22: 0.55,
    23: 0.3,
  },
  isCurve: true,
};

/** Midday peak pattern - peaks at 11am */
export const CURVE_MIDDAY_PEAK: TemporalTemplate = {
  hours: {
    0: 0.12,
    1: 0.11,
    2: 0.1,
    3: 0.1,
    4: 0.12,
    5: 0.2,
    6: 0.35,
    7: 0.55,
    8: 0.7,
    9: 0.82,
    10: 0.9,
    11: 0.95,
    12: 0.92,
    13: 0.9,
    14: 0.88,
    15: 0.85,
    16: 0.8,
    17: 0.7,
    18: 0.55,
    19: 0.4,
    20: 0.3,
    21: 0.22,
    22: 0.18,
    23: 0.15,
  },
  isCurve: true,
};

/** Late evening peak - peaks at 8-9pm */
export const CURVE_LATE_EVENING_PEAK: TemporalTemplate = {
  hours: {
    0: 0.25,
    1: 0.2,
    2: 0.18,
    3: 0.15,
    4: 0.15,
    5: 0.2,
    6: 0.3,
    7: 0.35,
    8: 0.4,
    9: 0.45,
    10: 0.5,
    11: 0.55,
    12: 0.6,
    13: 0.62,
    14: 0.65,
    15: 0.7,
    16: 0.75,
    17: 0.82,
    18: 0.9,
    19: 0.95,
    20: 1.0,
    21: 1.0,
    22: 0.85,
    23: 0.5,
  },
  isCurve: true,
};

/** E-commerce pattern - peaks at 8pm */
export const CURVE_ECOMMERCE: TemporalTemplate = {
  hours: {
    0: 0.25,
    1: 0.2,
    2: 0.18,
    3: 0.15,
    4: 0.15,
    5: 0.2,
    6: 0.3,
    7: 0.4,
    8: 0.5,
    9: 0.6,
    10: 0.65,
    11: 0.7,
    12: 0.75,
    13: 0.75,
    14: 0.7,
    15: 0.7,
    16: 0.75,
    17: 0.8,
    18: 0.9,
    19: 0.95,
    20: 1.0,
    21: 0.9,
    22: 0.7,
    23: 0.45,
  },
  isCurve: true,
};

//
// Spike Templates (Focused Peaks)
//

/** Morning spike - peaks 7-8am */
export const SPIKE_MORNING: TemporalTemplate = {
  hours: {
    0: 0.1,
    1: 0.1,
    2: 0.1,
    3: 0.1,
    4: 0.1,
    5: 0.2,
    6: 0.5,
    7: 1.0,
    8: 1.0,
    9: 0.8,
    10: 0.5,
    11: 0.2,
    12: 0.2,
    13: 0.2,
    14: 0.2,
    15: 0.2,
    16: 0.2,
    17: 0.2,
    18: 0.2,
    19: 0.2,
    20: 0.15,
    21: 0.15,
    22: 0.1,
    23: 0.1,
  },
  isCurve: true,
};

/** Lunch spike - peaks 12-1pm */
export const SPIKE_LUNCH: TemporalTemplate = {
  hours: {
    0: 0.1,
    1: 0.1,
    2: 0.1,
    3: 0.1,
    4: 0.1,
    5: 0.1,
    6: 0.15,
    7: 0.2,
    8: 0.2,
    9: 0.2,
    10: 0.3,
    11: 0.7,
    12: 1.0,
    13: 1.0,
    14: 0.6,
    15: 0.3,
    16: 0.2,
    17: 0.2,
    18: 0.2,
    19: 0.2,
    20: 0.15,
    21: 0.15,
    22: 0.1,
    23: 0.1,
  },
  isCurve: true,
};

/** Evening spike - peaks 6-7pm */
export const SPIKE_EVENING: TemporalTemplate = {
  hours: {
    0: 0.1,
    1: 0.1,
    2: 0.1,
    3: 0.1,
    4: 0.1,
    5: 0.1,
    6: 0.15,
    7: 0.2,
    8: 0.2,
    9: 0.2,
    10: 0.2,
    11: 0.2,
    12: 0.3,
    13: 0.3,
    14: 0.3,
    15: 0.3,
    16: 0.4,
    17: 0.6,
    18: 1.0,
    19: 1.0,
    20: 0.8,
    21: 0.5,
    22: 0.3,
    23: 0.2,
  },
  isCurve: true,
};

//
// Boost Templates (1.3x Multiplier)
//

/** Boost summer months */
export const BOOST_SUMMER: TemporalTemplate = {
  months: {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 1.3,
    7: 1.3,
    8: 1.3,
    9: 1.0,
    10: 1.0,
    11: 1.0,
    12: 1.0,
  },
  isCurve: true,
};

/** Boost winter months */
export const BOOST_WINTER: TemporalTemplate = {
  months: {
    1: 1.3,
    2: 1.3,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 1.0,
    7: 1.0,
    8: 1.0,
    9: 1.0,
    10: 1.0,
    11: 1.0,
    12: 1.3,
  },
  isCurve: true,
};

/** Boost weekends */
export const BOOST_WEEKENDS: TemporalTemplate = {
  days: {
    sunday: 1.3,
    monday: 1.0,
    tuesday: 1.0,
    wednesday: 1.0,
    thursday: 1.0,
    friday: 1.0,
    saturday: 1.3,
  },
  isCurve: true,
};

/** Boost weekdays */
export const BOOST_WEEKDAYS: TemporalTemplate = {
  days: {
    sunday: 1.0,
    monday: 1.3,
    tuesday: 1.3,
    wednesday: 1.3,
    thursday: 1.3,
    friday: 1.3,
    saturday: 1.0,
  },
  isCurve: true,
};

/** Boost holiday season (Nov-Dec) - 1.5x */
export const BOOST_HOLIDAY_SEASON: TemporalTemplate = {
  months: {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 1.0,
    7: 1.0,
    8: 1.0,
    9: 1.0,
    10: 1.0,
    11: 1.5,
    12: 1.5,
  },
  isCurve: true,
};

//
// Lull Templates (0.6x Multiplier)
//

/** Lull summer months */
export const LULL_SUMMER: TemporalTemplate = {
  months: {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 0.6,
    7: 0.6,
    8: 0.6,
    9: 1.0,
    10: 1.0,
    11: 1.0,
    12: 1.0,
  },
  isCurve: true,
};

/** Lull winter months */
export const LULL_WINTER: TemporalTemplate = {
  months: {
    1: 0.6,
    2: 0.6,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 1.0,
    7: 1.0,
    8: 1.0,
    9: 1.0,
    10: 1.0,
    11: 1.0,
    12: 0.6,
  },
  isCurve: true,
};

/** Lull weekends */
export const LULL_WEEKENDS: TemporalTemplate = {
  days: {
    sunday: 0.6,
    monday: 1.0,
    tuesday: 1.0,
    wednesday: 1.0,
    thursday: 1.0,
    friday: 1.0,
    saturday: 0.6,
  },
  isCurve: true,
};

/** Lull weekdays */
export const LULL_WEEKDAYS: TemporalTemplate = {
  days: {
    sunday: 1.0,
    monday: 0.6,
    tuesday: 0.6,
    wednesday: 0.6,
    thursday: 0.6,
    friday: 0.6,
    saturday: 1.0,
  },
  isCurve: true,
};

//
// Registry
//

/**
 * Registry of all available templates by name
 */
export const TEMPORAL_TEMPLATES: Record<string, TemporalTemplate> = {
  // Hours
  HOURS_24_7,
  HOURS_AFTERNOON_EVENING,
  HOURS_BUSINESS,
  HOURS_EARLY,
  HOURS_EVENING,
  HOURS_EXTENDED,
  HOURS_LIMITED,
  HOURS_OVERNIGHT,
  HOURS_RETAIL,
  HOURS_WEEKEND,

  // Days
  DAYS_NO_MONDAY,
  DAYS_NO_SUNDAY,
  DAYS_NO_SUNDAY_MONDAY,
  DAYS_WEEKDAYS_ONLY,

  // Dates
  DATES_15_AND_25,

  // Seasons
  SEASON_NO_SUMMER,
  SEASON_NO_WINTER,
  SEASON_SUMMER_ONLY,
  SEASON_WINTER_ONLY,

  // Curves
  CURVE_ECOMMERCE,
  CURVE_EVENING_PEAK,
  CURVE_LATE_EVENING_PEAK,
  CURVE_MIDDAY_PEAK,

  // Spikes
  SPIKE_EVENING,
  SPIKE_LUNCH,
  SPIKE_MORNING,

  // Boosts
  BOOST_HOLIDAY_SEASON,
  BOOST_SUMMER,
  BOOST_WEEKDAYS,
  BOOST_WEEKENDS,
  BOOST_WINTER,

  // Lulls
  LULL_SUMMER,
  LULL_WEEKDAYS,
  LULL_WEEKENDS,
  LULL_WINTER,
};

// Backward compatibility alias
export const TRANSACTION_TEMPLATES = TEMPORAL_TEMPLATES;
