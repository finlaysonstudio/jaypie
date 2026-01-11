import type { TemporalTemplate } from "../templates/types.js";

//
// Timing
//

/**
 * Timing configuration for derived events
 */
export interface DerivedTiming {
  /** Timing mode determines how the delay is calculated */
  mode: "fixed" | "range" | "recurring" | "same-day";

  /** Minimum delay (for 'fixed': exact delay, for 'range': minimum) */
  delayMin?: number;

  /** Maximum delay (for 'range' mode only) */
  delayMax?: number;

  /** Time unit for delay values (default: 'days') */
  unit?:
    | "days"
    | "hours"
    | "milliseconds"
    | "minutes"
    | "months"
    | "seconds"
    | "weeks";

  /** Interval for recurring events */
  interval?: number;

  /** Maximum number of recurring instances */
  maxRecurrences?: number;

  /** End condition for recurring events */
  until?: Date | "end-of-year";

  /** Template for time-of-day distribution */
  template?: string | TemporalTemplate;
}

//
// Create Params
//

/**
 * Parameters passed to derived event creation function
 */
export interface DerivedCreateParams<TParent> {
  /** Depth in the derived chain (0 = first-level derived event) */
  depth: number;

  /** Zero-based index of this derived event (for recurring) */
  index: number;

  /** The parent event that triggered this derived event */
  parent: TParent;

  /** The rule that created this derived event */
  ruleName: string;

  /** Deterministic seed for this derived event */
  seed: string;

  /** Timestamp for the derived event */
  timestamp: Date;
}

//
// Rules
//

/**
 * Defines a rule that can spawn derived (follow-up) events
 */
export interface DerivedRule<TParent, TChild = TParent> {
  /** Optional condition - derived event only triggers if this returns true */
  condition?: (parent: TParent) => boolean;

  /** Factory function to create the derived event */
  createDerived: (params: DerivedCreateParams<TParent>) => TChild;

  /** Nested rules for events created by this rule */
  derived?: DerivedRule<TChild, unknown>[];

  /** Unique identifier for this rule (used in seed generation) */
  name: string;

  /** Probability (0-1) that this derived event occurs. Use CHANCE constants. */
  probability: number;

  /** Timing configuration */
  timing: DerivedTiming;
}

//
// Config
//

/**
 * Configuration for derived event generation
 */
export interface DerivedConfig<T> {
  /** How to handle derived events outside target year */
  boundaryBehavior?: "clamp" | "exclude" | "include";

  /** Maximum derived chain depth (default: 5) */
  maxDepth?: number;

  /** Derived rules to apply */
  rules: DerivedRule<T, unknown>[];
}

//
// Event Metadata
//

/**
 * Event wrapper that tracks derived event metadata
 */
export interface EventWithDerivedMeta<T> {
  /** Depth in derived chain (0 for primary events) */
  depth: number;

  /** The event instance */
  event: T;

  /** Parent event seed (undefined for primary events) */
  parentSeed?: string;

  /** Rule that created this event (undefined for primary events) */
  ruleName?: string;
}

/**
 * Interface for events that have a timestamp (used by evaluator)
 */
export interface TimestampedEvent {
  timestamp: Date;
}
