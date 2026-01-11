import { Fabricator, type FabricatorOptions } from "./Fabricator.js";
import { DerivedEvaluator } from "./derived/DerivedEvaluator.js";
import type {
  DerivedConfig,
  EventWithDerivedMeta,
  TimestampedEvent,
} from "./derived/types.js";
import { mergeTemplates } from "./templates/mergeTemplates.js";
import type { TemporalTemplate } from "./templates/types.js";
import { DAY_NAME_TO_NUMBER, MONTH_NAME_TO_NUMBER } from "./templates/types.js";
import { getISOWeekNumber } from "./temporal/isoWeek.js";
import { getDaysInYear } from "./temporal/iterateYear.js";
import { shiftHoursForTimezone } from "./temporal/shiftHoursForTimezone.js";

//
// Constants
//

const DEFAULT_ANNUAL_COUNT = 1000;

//
// Types
//

export interface EventFabricatorOptions<T extends TimestampedEvent = TimestampedEvent>
  extends FabricatorOptions {
  /** Number of events to generate per year (default: 1000) */
  annualCount?: number;
  /** Derived event configuration */
  derived?: DerivedConfig<T>;
  /** Template name(s) or template object(s) for time distribution */
  template?: string | string[] | TemporalTemplate | TemporalTemplate[];
  /** IANA timezone identifier for shifting hour weights to UTC */
  timezone?: string;
}

export interface EventGenerationConfig {
  /** Override annualCount for this generation */
  count?: number;
  /** Year to generate events for (defaults to current year) */
  year?: number;
}

export interface CreateEventParams {
  /** Zero-based index of this event in the generated array */
  index: number;
  /** Deterministic seed for this event (format: `${parentId}-event-${index}`) */
  seed: string;
  /** The timestamp for this event */
  timestamp: Date;
}

//
// Class
//

/**
 * Abstract base class for generating temporally-distributed events
 *
 * Subclasses must implement createEvent() to produce domain-specific event instances.
 *
 * @example
 * class TransactionGenerator extends EventFabricator<Transaction> {
 *   protected createEvent({ timestamp, seed, index }) {
 *     return new Transaction({ timestamp, amount: 100, seed });
 *   }
 * }
 *
 * const generator = new TransactionGenerator({
 *   template: ['HOURS_BUSINESS', 'DAYS_WEEKDAYS_ONLY'],
 *   timezone: 'America/New_York',
 *   annualCount: 1000,
 * });
 *
 * const events = generator.events({ year: 2025 });
 */
export abstract class EventFabricator<
  T extends TimestampedEvent = TimestampedEvent,
> extends Fabricator {
  protected readonly annualCount: number;
  protected readonly dateWeights?: Record<number, number>;
  protected readonly dayWeights?: Record<number | string, number>;
  protected readonly derivedConfig?: DerivedConfig<T>;
  protected readonly hourlyWeights?: Record<number, number>;
  protected readonly monthlyWeights?: Record<number | string, number>;
  protected readonly weeklyWeights?: Record<number, number>;

  constructor(options: EventFabricatorOptions<T> = {}) {
    super({
      generator: options.generator,
      name: options.name,
      seed: options.seed,
    });

    this.annualCount = options.annualCount ?? DEFAULT_ANNUAL_COUNT;
    this.derivedConfig = options.derived;

    // Resolve templates if provided
    let templateWeights: TemporalTemplate | undefined;
    if (options.template) {
      const templates = Array.isArray(options.template)
        ? options.template
        : [options.template];
      templateWeights = mergeTemplates({ templates });
    }

    // Apply timezone shifting to hour weights
    let resolvedHourWeights = templateWeights?.hours;
    if (resolvedHourWeights && options.timezone) {
      resolvedHourWeights = shiftHoursForTimezone({
        hours: resolvedHourWeights,
        timezone: options.timezone,
      });
    }

    // Store resolved weights
    this.monthlyWeights = templateWeights?.months;
    this.weeklyWeights = templateWeights?.weeks;
    this.dayWeights = templateWeights?.days;
    this.dateWeights = templateWeights?.dates;
    this.hourlyWeights = resolvedHourWeights;
  }

  /**
   * Factory method to create individual event instances
   * Must be implemented by subclasses
   *
   * @param params.timestamp - The timestamp for this event
   * @param params.seed - Deterministic seed for this event (format: `${parentId}-event-${index}`)
   * @param params.index - Zero-based index of this event in the generated array
   */
  protected abstract createEvent(params: CreateEventParams): T;

  /**
   * Generates an array of events distributed across a year
   *
   * Distribution algorithm:
   * 1. Get all days in the target year (365 or 366)
   * 2. Calculate weight for each day (month × week × day × date)
   * 3. Normalize weights to probabilities
   * 4. Distribute annualCount events across days using weighted random
   * 5. For each day with events, distribute within day using hourly weights
   * 6. Sort all events chronologically
   * 7. Call createEvent() for each timestamp
   *
   * @param config - Generation configuration
   * @returns Array of event instances sorted by timestamp
   */
  events(config: EventGenerationConfig = {}): T[] {
    const targetYear = config.year ?? new Date().getFullYear();
    const count = config.count ?? this.annualCount;

    // Get all days in the year
    const days = getDaysInYear(targetYear);

    // Calculate weight for each day
    const dayWeights = days.map((day) => {
      const month = day.getUTCMonth() + 1;
      const week = getISOWeekNumber(day);
      const dayOfWeek = day.getUTCDay();
      const date = day.getUTCDate();

      let weight = 1;
      weight *= this.getWeight(this.monthlyWeights, month);
      weight *= this.getWeight(this.weeklyWeights, week);
      weight *= this.getWeight(this.dayWeights, dayOfWeek);
      weight *= this.getWeight(this.dateWeights, date);
      return weight;
    });

    // Normalize weights
    const totalWeight = dayWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights =
      totalWeight > 0 ? dayWeights.map((w) => w / totalWeight) : dayWeights;

    // Distribute events across days using weighted random
    const eventsPerDay = new Array(days.length).fill(0) as number[];
    const fabricatorWithYearSeed = new Fabricator({
      seed: `${this.id}-year-${targetYear}`,
    });

    for (let i = 0; i < count; i++) {
      const rand = fabricatorWithYearSeed.random();
      let cumulative = 0;
      for (let d = 0; d < days.length; d++) {
        cumulative += normalizedWeights[d];
        if (rand <= cumulative) {
          eventsPerDay[d]++;
          break;
        }
      }
    }

    // Generate events for each day
    const allEvents: T[] = [];
    let eventIndex = 0;

    days.forEach((day, dayIndex) => {
      const dayCount = eventsPerDay[dayIndex];
      if (dayCount === 0) return;

      // Generate timestamps within this day
      const timestamps = this.generateDayTimestamps(
        day,
        dayCount,
        fabricatorWithYearSeed,
      );

      // Create events
      timestamps.forEach((ts) => {
        const seed = `${this.id}-event-${eventIndex}`;
        allEvents.push(
          this.createEvent({
            index: eventIndex,
            seed,
            timestamp: new Date(ts),
          }),
        );
        eventIndex++;
      });
    });

    // If derived config exists, process derived events
    if (this.derivedConfig) {
      const withMeta = this.processDerived(allEvents, targetYear);
      return withMeta.map((item) => item.event);
    }

    return allEvents;
  }

  /**
   * Generates events with derived event metadata attached
   * Useful for analyzing event relationships
   */
  eventsWithMeta(config: EventGenerationConfig = {}): EventWithDerivedMeta<T>[] {
    // Generate primary events without derived event processing
    const targetYear = config.year ?? new Date().getFullYear();
    const count = config.count ?? this.annualCount;

    // Get all days in the year
    const days = getDaysInYear(targetYear);

    // Calculate weight for each day
    const dayWeights = days.map((day) => {
      const month = day.getUTCMonth() + 1;
      const week = getISOWeekNumber(day);
      const dayOfWeek = day.getUTCDay();
      const date = day.getUTCDate();

      let weight = 1;
      weight *= this.getWeight(this.monthlyWeights, month);
      weight *= this.getWeight(this.weeklyWeights, week);
      weight *= this.getWeight(this.dayWeights, dayOfWeek);
      weight *= this.getWeight(this.dateWeights, date);
      return weight;
    });

    // Normalize weights
    const totalWeight = dayWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights =
      totalWeight > 0 ? dayWeights.map((w) => w / totalWeight) : dayWeights;

    // Distribute events across days using weighted random
    const eventsPerDay = new Array(days.length).fill(0) as number[];
    const fabricatorWithYearSeed = new Fabricator({
      seed: `${this.id}-year-${targetYear}`,
    });

    for (let i = 0; i < count; i++) {
      const rand = fabricatorWithYearSeed.random();
      let cumulative = 0;
      for (let d = 0; d < days.length; d++) {
        cumulative += normalizedWeights[d];
        if (rand <= cumulative) {
          eventsPerDay[d]++;
          break;
        }
      }
    }

    // Generate events for each day
    const primaryEvents: T[] = [];
    let eventIndex = 0;

    days.forEach((day, dayIndex) => {
      const dayCount = eventsPerDay[dayIndex];
      if (dayCount === 0) return;

      const timestamps = this.generateDayTimestamps(
        day,
        dayCount,
        fabricatorWithYearSeed,
      );

      timestamps.forEach((ts) => {
        const seed = `${this.id}-event-${eventIndex}`;
        primaryEvents.push(
          this.createEvent({
            index: eventIndex,
            seed,
            timestamp: new Date(ts),
          }),
        );
        eventIndex++;
      });
    });

    // If no derived config, wrap primary events with basic metadata
    if (!this.derivedConfig) {
      return primaryEvents.map((event) => ({
        depth: 0,
        event,
      }));
    }

    return this.processDerived(primaryEvents, targetYear);
  }

  /**
   * Process derived events using the evaluator
   */
  private processDerived(
    primaryEvents: T[],
    targetYear: number,
  ): EventWithDerivedMeta<T>[] {
    if (!this.derivedConfig) {
      return primaryEvents.map((event) => ({ depth: 0, event }));
    }

    const evaluator = new DerivedEvaluator({
      derivedConfig: this.derivedConfig,
      fabricatorId: this.id,
      targetYear,
    });

    return evaluator.processEvents(primaryEvents);
  }

  /**
   * Gets weight for a specific temporal key
   * Handles conversion between numeric and string keys
   */
  protected getWeight(
    weights: Record<number | string, number> | undefined,
    key: number | string,
  ): number {
    if (!weights) {
      return 1;
    }

    // Try direct lookup first
    if (weights[key] !== undefined) {
      return weights[key];
    }

    // For day of week, try name lookup
    if (typeof key === "number" && key >= 0 && key <= 6) {
      const dayName = Object.entries(DAY_NAME_TO_NUMBER).find(
        ([, v]) => v === key,
      )?.[0];
      if (dayName && weights[dayName] !== undefined) {
        return weights[dayName];
      }
    }

    // For month, try name lookup
    if (typeof key === "number" && key >= 1 && key <= 12) {
      const monthName = Object.entries(MONTH_NAME_TO_NUMBER).find(
        ([, v]) => v === key,
      )?.[0];
      if (monthName && weights[monthName] !== undefined) {
        return weights[monthName];
      }
    }

    // Default weight is 1 (no modification)
    return 1;
  }

  /**
   * Normalizes month name to number (1-12)
   */
  protected normalizeMonth(key: number | string): number {
    if (typeof key === "number") {
      return key;
    }
    return MONTH_NAME_TO_NUMBER[key.toLowerCase()] ?? 1;
  }

  /**
   * Normalizes day name to number (0-6, Sunday=0)
   */
  protected normalizeDay(key: number | string): number {
    if (typeof key === "number") {
      return key;
    }
    return DAY_NAME_TO_NUMBER[key.toLowerCase()] ?? 0;
  }

  /**
   * Generates timestamps within a day based on hourly weights
   */
  private generateDayTimestamps(
    day: Date,
    count: number,
    fabricator: Fabricator,
  ): number[] {
    const timestamps: number[] = [];
    const dayStart = day.getTime();

    if (!this.hourlyWeights || Object.keys(this.hourlyWeights).length === 0) {
      // No hourly weights - distribute uniformly across the day
      for (let i = 0; i < count; i++) {
        const millisInDay = 24 * 60 * 60 * 1000;
        const randomMs = Math.floor(fabricator.random() * millisInDay);
        timestamps.push(dayStart + randomMs);
      }
    } else {
      // Use hourly weights
      const hours = Object.keys(this.hourlyWeights).map(Number);
      const weights = hours.map((h) => this.hourlyWeights![h]);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = weights.map((w) => w / totalWeight);

      for (let i = 0; i < count; i++) {
        // Pick an hour based on weights
        const rand = fabricator.random();
        let cumulative = 0;
        let selectedHour = hours[0];

        for (let h = 0; h < hours.length; h++) {
          cumulative += normalizedWeights[h];
          if (rand <= cumulative) {
            selectedHour = hours[h];
            break;
          }
        }

        // Generate random minute and second within the hour
        const minute = Math.floor(fabricator.random() * 60);
        const second = Math.floor(fabricator.random() * 60);
        const ms = Math.floor(fabricator.random() * 1000);

        const timestamp =
          dayStart +
          selectedHour * 60 * 60 * 1000 +
          minute * 60 * 1000 +
          second * 1000 +
          ms;

        timestamps.push(timestamp);
      }
    }

    // Sort timestamps chronologically
    return timestamps.sort((a, b) => a - b);
  }
}
