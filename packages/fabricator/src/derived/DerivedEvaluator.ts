import { Fabricator } from "../Fabricator.js";
import type {
  DerivedConfig,
  DerivedRule,
  EventWithDerivedMeta,
  TimestampedEvent,
} from "./types.js";

//
// Constants
//

const DEFAULT_MAX_DEPTH = 5;

const MS_PER_UNIT: Record<string, number> = {
  days: 24 * 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  milliseconds: 1,
  minutes: 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000, // Approximate
  seconds: 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

//
// Types
//

interface DerivedEvaluatorConfig<T> {
  derivedConfig: DerivedConfig<T>;
  fabricatorId: string;
  targetYear: number;
}

//
// Class
//

/**
 * Evaluates derived rules and generates follow-up events
 */
export class DerivedEvaluator<T extends TimestampedEvent> {
  private readonly boundaryBehavior: "clamp" | "exclude" | "include";
  private readonly config: DerivedConfig<T>;
  private readonly fabricatorId: string;
  private readonly maxDepth: number;
  private readonly targetYear: number;

  constructor(options: DerivedEvaluatorConfig<T>) {
    this.config = options.derivedConfig;
    this.fabricatorId = options.fabricatorId;
    this.targetYear = options.targetYear;
    this.maxDepth = this.config.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.boundaryBehavior = this.config.boundaryBehavior ?? "exclude";
  }

  /**
   * Process primary events and generate all derived events
   * Returns a merged, chronologically sorted array
   */
  processEvents(primaryEvents: T[]): EventWithDerivedMeta<T>[] {
    const allEvents: EventWithDerivedMeta<T>[] = [];

    // Add primary events with metadata
    for (const event of primaryEvents) {
      allEvents.push({
        depth: 0,
        event,
      });
    }

    // Process each event for potential derived events
    let eventsToProcess = [...allEvents];

    while (eventsToProcess.length > 0) {
      const newDerived: EventWithDerivedMeta<T>[] = [];

      for (const item of eventsToProcess) {
        const derived = this.evaluateRules(item);
        newDerived.push(...derived);
      }

      allEvents.push(...newDerived);
      eventsToProcess = newDerived;
    }

    // Sort chronologically and apply boundary behavior
    return this.finalizeEvents(allEvents);
  }

  /**
   * Calculate timestamp(s) for a derived event based on timing config
   */
  private calculateTimestamps(
    rule: DerivedRule<T, unknown>,
    parentEvent: T,
    parentSeed: string,
  ): Date[] {
    const { timing } = rule;
    const parentTime = parentEvent.timestamp.getTime();
    const timingSeed = `${parentSeed}-${rule.name}-timing`;
    const fab = new Fabricator({ seed: timingSeed });

    switch (timing.mode) {
      case "same-day": {
        // Same day, but potentially different hour
        const parentDate = new Date(parentTime);
        const hourOffset = Math.floor(fab.random() * 12); // Up to 12 hours later
        const newTime = parentTime + hourOffset * MS_PER_UNIT.hours;

        // Ensure same day
        const newDate = new Date(newTime);
        if (newDate.getUTCDate() !== parentDate.getUTCDate()) {
          // Clamp to end of same day
          return [
            new Date(
              Date.UTC(
                parentDate.getUTCFullYear(),
                parentDate.getUTCMonth(),
                parentDate.getUTCDate(),
                23,
                59,
                59,
                999,
              ),
            ),
          ];
        }
        return [newDate];
      }

      case "fixed": {
        const unit = timing.unit ?? "days";
        const delay = (timing.delayMin ?? 1) * MS_PER_UNIT[unit];
        return [new Date(parentTime + delay)];
      }

      case "range": {
        const unit = timing.unit ?? "days";
        const minDelay = (timing.delayMin ?? 1) * MS_PER_UNIT[unit];
        const maxDelay = (timing.delayMax ?? timing.delayMin ?? 7) * MS_PER_UNIT[unit];
        const delay = minDelay + fab.random() * (maxDelay - minDelay);
        return [new Date(parentTime + Math.floor(delay))];
      }

      case "recurring": {
        const timestamps: Date[] = [];
        const unit = timing.unit ?? "months";
        const interval = (timing.interval ?? 1) * MS_PER_UNIT[unit];
        const maxRecurrences = timing.maxRecurrences ?? 12;

        // Determine end date
        let endTime: number;
        if (timing.until === "end-of-year") {
          endTime = Date.UTC(this.targetYear, 11, 31, 23, 59, 59, 999);
        } else if (timing.until instanceof Date) {
          endTime = timing.until.getTime();
        } else {
          // Default to end of year
          endTime = Date.UTC(this.targetYear, 11, 31, 23, 59, 59, 999);
        }

        let currentTime = parentTime + interval;
        let count = 0;

        while (currentTime <= endTime && count < maxRecurrences) {
          timestamps.push(new Date(currentTime));
          currentTime += interval;
          count++;
        }

        return timestamps;
      }

      default:
        return [];
    }
  }

  /**
   * Evaluate all applicable rules for an event
   */
  private evaluateRules(item: EventWithDerivedMeta<T>): EventWithDerivedMeta<T>[] {
    // Check depth limit
    if (item.depth >= this.maxDepth) {
      return [];
    }

    const derivedEvents: EventWithDerivedMeta<T>[] = [];

    // Determine which rules apply
    const rules = item.ruleName
      ? this.findNestedRules(item.ruleName)
      : this.config.rules;

    for (const rule of rules) {
      const ruleDerived = this.evaluateRule(
        rule as DerivedRule<T, T>,
        item,
      );
      derivedEvents.push(...ruleDerived);
    }

    return derivedEvents;
  }

  /**
   * Evaluate a single rule against an event
   */
  private evaluateRule(
    rule: DerivedRule<T, T>,
    item: EventWithDerivedMeta<T>,
  ): EventWithDerivedMeta<T>[] {
    const event = item.event;
    const eventSeed = this.getEventSeed(item);

    // Check condition
    if (rule.condition && !rule.condition(event)) {
      return [];
    }

    // Check probability using deterministic random
    const probSeed = `${eventSeed}-${rule.name}-prob`;
    const probFab = new Fabricator({ seed: probSeed });
    const roll = probFab.random();

    if (roll >= rule.probability) {
      return [];
    }

    // Generate derived event timestamp(s)
    const timestamps = this.calculateTimestamps(rule, event, eventSeed);

    // Create derived events
    return timestamps.map((timestamp, index) => {
      const derivedSeed = `${eventSeed}-${rule.name}-${index}`;
      const derivedEvent = rule.createDerived({
        depth: item.depth + 1,
        index,
        parent: event,
        ruleName: rule.name,
        seed: derivedSeed,
        timestamp,
      }) as T;

      return {
        depth: item.depth + 1,
        event: derivedEvent,
        parentSeed: eventSeed,
        ruleName: rule.name,
      };
    });
  }

  /**
   * Apply boundary behavior and sort events
   */
  private finalizeEvents(
    events: EventWithDerivedMeta<T>[],
  ): EventWithDerivedMeta<T>[] {
    const yearStart = Date.UTC(this.targetYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = Date.UTC(this.targetYear, 11, 31, 23, 59, 59, 999);

    let filtered = events;

    if (this.boundaryBehavior === "exclude") {
      filtered = events.filter((item) => {
        const time = item.event.timestamp.getTime();
        return time >= yearStart && time <= yearEnd;
      });
    } else if (this.boundaryBehavior === "clamp") {
      filtered = events.map((item) => {
        const time = item.event.timestamp.getTime();
        if (time < yearStart) {
          return {
            ...item,
            event: {
              ...item.event,
              timestamp: new Date(yearStart),
            },
          };
        }
        if (time > yearEnd) {
          return {
            ...item,
            event: {
              ...item.event,
              timestamp: new Date(yearEnd),
            },
          };
        }
        return item;
      });
    }
    // 'include' - no filtering

    // Sort chronologically
    return filtered.sort(
      (a, b) => a.event.timestamp.getTime() - b.event.timestamp.getTime(),
    );
  }

  /**
   * Find nested rules for a given parent rule name
   */
  private findNestedRules(ruleName: string): DerivedRule<T, unknown>[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findInRules = (rules: DerivedRule<any, any>[]): DerivedRule<T, unknown>[] => {
      for (const rule of rules) {
        if (rule.name === ruleName && rule.derived) {
          return rule.derived as DerivedRule<T, unknown>[];
        }
        if (rule.derived) {
          const found = findInRules(rule.derived);
          if (found.length > 0) {
            return found;
          }
        }
      }
      return [];
    };

    return findInRules(this.config.rules as DerivedRule<T, unknown>[]);
  }

  /**
   * Get the seed for an event (either from metadata or generate from id)
   */
  private getEventSeed(item: EventWithDerivedMeta<T>): string {
    // If this is a derived event, use the parent seed + rule name
    if (item.parentSeed && item.ruleName) {
      return `${item.parentSeed}-${item.ruleName}`;
    }

    // For primary events, generate seed from fabricator id and index
    // We use timestamp as a proxy for uniqueness
    return `${this.fabricatorId}-${item.event.timestamp.getTime()}`;
  }
}
