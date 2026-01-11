import type { TemporalTemplate } from "./types.js";
import { TEMPORAL_TEMPLATES } from "./registry.js";

/**
 * Resolves a template by name or returns it if already a template object
 */
function resolveTemplate(
  template: string | TemporalTemplate,
): TemporalTemplate {
  if (typeof template === "string") {
    const resolved = TEMPORAL_TEMPLATES[template];
    if (!resolved) {
      throw new Error(`Unknown template: ${template}`);
    }
    return resolved;
  }
  return template;
}

/**
 * Merges weights from two records
 * For curve templates (multiplicative), only applies to existing keys
 * For non-curve templates, creates union of all keys
 */
function mergeWeights(
  base: Record<number | string, number> | undefined,
  overlay: Record<number | string, number> | undefined,
  isCurve: boolean,
): Record<number | string, number> | undefined {
  if (!overlay) {
    return base;
  }
  if (!base) {
    // Curves don't create new keys, so return undefined if no base
    return isCurve ? undefined : overlay;
  }

  const result: Record<number | string, number> = {};

  if (isCurve) {
    // Multiplicative: only modify existing keys
    for (const [key, value] of Object.entries(base)) {
      const overlayValue = overlay[key];
      if (overlayValue !== undefined) {
        result[key] = value * overlayValue;
      } else {
        result[key] = value;
      }
    }
  } else {
    // Union: combine all keys
    const allKeys = new Set([...Object.keys(base), ...Object.keys(overlay)]);
    for (const key of allKeys) {
      const baseValue = base[key] ?? 1;
      const overlayValue = overlay[key] ?? 1;
      result[key] = baseValue * overlayValue;
    }
  }

  return result;
}

/**
 * Merges multiple templates by multiplying their weights
 *
 * Algorithm:
 * 1. Separate templates into curve and non-curve
 * 2. Merge non-curve templates first (union of all keys)
 * 3. Apply curve templates only to existing keys (multiplicative)
 *
 * @param config.templates - Array of template names or template objects
 * @returns Merged template with combined weights
 *
 * @example
 * // Combine business hours with evening peak curve
 * const merged = mergeTemplates({
 *   templates: ['HOURS_BUSINESS', 'CURVE_MIDDAY_PEAK', 'BOOST_WEEKDAYS']
 * });
 * // Result: Business hours (8-17) shaped by midday peak, boosted on weekdays
 */
export function mergeTemplates({
  templates,
}: {
  templates: (string | TemporalTemplate)[];
}): TemporalTemplate {
  if (templates.length === 0) {
    return {};
  }

  // Resolve all templates
  const resolved = templates.map(resolveTemplate);

  // Separate curve and non-curve templates
  const nonCurveTemplates = resolved.filter((t) => !t.isCurve);
  const curveTemplates = resolved.filter((t) => t.isCurve);

  // Start with merged non-curve templates
  let result: TemporalTemplate = {};

  // Merge non-curve templates first (creating the base distribution)
  for (const template of nonCurveTemplates) {
    result = {
      months: mergeWeights(result.months, template.months, false),
      weeks: mergeWeights(
        result.weeks as Record<number | string, number> | undefined,
        template.weeks as Record<number | string, number> | undefined,
        false,
      ) as Record<number, number> | undefined,
      days: mergeWeights(result.days, template.days, false),
      dates: mergeWeights(
        result.dates as Record<number | string, number> | undefined,
        template.dates as Record<number | string, number> | undefined,
        false,
      ) as Record<number, number> | undefined,
      hours: mergeWeights(
        result.hours as Record<number | string, number> | undefined,
        template.hours as Record<number | string, number> | undefined,
        false,
      ) as Record<number, number> | undefined,
    };
  }

  // Apply curve templates (multiplicative only on existing keys)
  for (const template of curveTemplates) {
    result = {
      months: mergeWeights(result.months, template.months, true),
      weeks: mergeWeights(
        result.weeks as Record<number | string, number> | undefined,
        template.weeks as Record<number | string, number> | undefined,
        true,
      ) as Record<number, number> | undefined,
      days: mergeWeights(result.days, template.days, true),
      dates: mergeWeights(
        result.dates as Record<number | string, number> | undefined,
        template.dates as Record<number | string, number> | undefined,
        true,
      ) as Record<number, number> | undefined,
      hours: mergeWeights(
        result.hours as Record<number | string, number> | undefined,
        template.hours as Record<number | string, number> | undefined,
        true,
      ) as Record<number, number> | undefined,
    };
  }

  // Remove undefined values
  const cleaned: TemporalTemplate = {};
  if (result.months) cleaned.months = result.months;
  if (result.weeks) cleaned.weeks = result.weeks;
  if (result.days) cleaned.days = result.days;
  if (result.dates) cleaned.dates = result.dates;
  if (result.hours) cleaned.hours = result.hours;

  return cleaned;
}
