import { createHash } from "node:crypto";

import { REDACT_ENV } from "./constants";
import { isPlainObject } from "./limits";

//
//
// Types
//

export interface RedactContext {
  key?: string;
  path: string;
}

/**
 * Custom redaction hook. Called for every node the redaction walk visits,
 * before built-in rules. Return a replacement value to use it verbatim
 * (no further descent); return `undefined` to defer to built-in rules.
 */
export type RedactHook = (value: unknown, context: RedactContext) => unknown;

/**
 * Caller-facing redaction options. `redact: false` disables all scrubbing;
 * a function adds a custom hook ahead of built-in rules. `redactKeys` adds
 * field names to the built-in denylist (auth-style rendering).
 */
export interface RedactionOptions {
  redact?: RedactHook | false;
  redactKeys?: string[];
}

export type Redactor = (value: unknown, context?: { key?: string }) => unknown;

type RedactRender = "auth" | "binLast4" | "last4" | "redacted";

interface SecretValue {
  toJSON(): unknown;
  toString(): string;
  valueOf(): unknown;
}

//
//
// Constants
//

// A cycle re-visit collapses to this rather than returning the original
// (unredacted) reference
const CIRCULAR_PLACEHOLDER = "[Circular]";
const DISABLED_ENV_VALUES = ["", "0", "false", "none", "off"];
const ELLIPSIS = "…";
// Walk budgets keep redaction cheap on large events; nodes beyond the
// budget pass through unredacted rather than truncating the entry
const MAX_DEPTH = 32;
const MAX_NODES = 25000;
// Below this length a partial reveal shows too much of the value
const MIN_PARTIAL_LENGTH = 8;
// Shortest real primary account number
const MIN_PAN_LENGTH = 13;
export const REDACTED = "redacted";

const RENDER: Record<string, RedactRender> = {
  AUTH: "auth",
  BIN_LAST4: "binLast4",
  LAST4: "last4",
  REDACTED: "redacted",
};

// Field names redacted whenever they appear at any depth, matched after
// normalization (lowercase, separators stripped). A name belongs here only
// when no application logs it legitimately; ambiguous names like `key` and
// `token` are handled by the value heuristic instead.
const DEFAULT_REDACT_KEYS: Record<string, RedactRender> = {
  accesstoken: RENDER.AUTH,
  accountnumber: RENDER.LAST4,
  apikey: RENDER.AUTH,
  apisecret: RENDER.AUTH,
  authorization: RENDER.AUTH,
  bankaccountnumber: RENDER.LAST4,
  bearertoken: RENDER.AUTH,
  cardnumber: RENDER.BIN_LAST4,
  ccnumber: RENDER.BIN_LAST4,
  clientsecret: RENDER.AUTH,
  creditcard: RENDER.BIN_LAST4,
  creditcardnumber: RENDER.BIN_LAST4,
  cvc: RENDER.REDACTED,
  cvc2: RENDER.REDACTED,
  cvv: RENDER.REDACTED,
  cvv2: RENDER.REDACTED,
  debitcard: RENDER.BIN_LAST4,
  debitcardnumber: RENDER.BIN_LAST4,
  iban: RENDER.LAST4,
  idtoken: RENDER.AUTH,
  mfacode: RENDER.REDACTED,
  otp: RENDER.REDACTED,
  pan: RENDER.BIN_LAST4,
  passphrase: RENDER.AUTH,
  password: RENDER.AUTH,
  pin: RENDER.REDACTED,
  pincode: RENDER.REDACTED,
  privatekey: RENDER.AUTH,
  refreshtoken: RENDER.AUTH,
  routingnumber: RENDER.LAST4,
  secret: RENDER.AUTH,
  secretaccesskey: RENDER.AUTH,
  secretkey: RENDER.AUTH,
  securitycode: RENDER.REDACTED,
  sessiontoken: RENDER.AUTH,
  signingsecret: RENDER.AUTH,
  socialsecuritynumber: RENDER.LAST4,
  ssn: RENDER.LAST4,
  taxid: RENDER.LAST4,
  webhooksecret: RENDER.AUTH,
  xapikey: RENDER.AUTH,
  xservicekey: RENDER.AUTH,
  xwebhooktoken: RENDER.AUTH,
};

// Names too load-bearing to always redact (S3 keys, DynamoDB keys, design
// tokens); string values under these run through looksSecret instead
const AMBIGUOUS_KEYS = new Set([
  "auth",
  "credential",
  "credentials",
  "key",
  "token",
]);

// Known credential shapes; precise enough to check every logged string
const SECRET_VALUE_PATTERNS = [
  // Stripe/OpenAI-style secret and restricted keys (digit required so
  // slugs like "sk-hynix-chips" pass through)
  /^[rs]k[-_](?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{8,}$/,
  // AWS access key ids
  /^(AKIA|ASIA)[A-Z0-9]{16}$/,
  // GitHub and GitLab tokens
  /^gh[opsu]_[A-Za-z0-9]{20,}$/,
  /^github_pat_[A-Za-z0-9_]{20,}$/,
  /^glpat-[A-Za-z0-9_-]{20,}$/,
  // Slack tokens
  /^xox[a-z]-[A-Za-z0-9-]{10,}$/,
  // Google API keys
  /^AIza[A-Za-z0-9_-]{30,}$/,
  // Stripe webhook signing secrets
  /^whsec_[A-Za-z0-9]{16,}$/,
  // JWTs
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/,
];

const MIN_RARE_LETTERS = 2;
const RARE_LETTER_PATTERN = /[jkqvxz]/gi;
const SECRET_MAX_LENGTH = 512;
const SECRET_MIN_LENGTH = 16;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECRET_BRAND = Symbol.for("jaypie.secret");

//
//
// Helpers
//

export function redactAuth(value: unknown): string {
  const str = String(value);
  if (/sk\S+/.test(str)) {
    return `sk_${str.slice(-4)}`;
  }
  const hash = createHash("md5").update(str).digest("hex");
  return `md5_${hash.slice(-4)}`;
}

function normalizeKeyName(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, "");
}

function renderLast4(value: string): string {
  const cleaned = value.replace(/[\s-]/g, "");
  if (cleaned.length < MIN_PARTIAL_LENGTH) return REDACTED;
  return `${ELLIPSIS}${cleaned.slice(-4)}`;
}

function renderBinLast4(value: string): string {
  const cleaned = value.replace(/[\s-]/g, "");
  if (cleaned.length < MIN_PAN_LENGTH) return renderLast4(value);
  return `${cleaned.slice(0, 6)}${ELLIPSIS}${cleaned.slice(-4)}`;
}

function applyRender(render: RedactRender, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") return REDACTED;
  switch (render) {
    case RENDER.BIN_LAST4:
      return renderBinLast4(String(value));
    case RENDER.LAST4:
      return renderLast4(String(value));
    case RENDER.REDACTED:
      return REDACTED;
    default:
      return redactAuth(value);
  }
}

function matchesSecretPattern(value: string): boolean {
  if (/\s/.test(value)) return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Heuristic for whether a string is a credential rather than a path, id,
 * or ordinary content. Known credential shapes match outright; otherwise
 * the value must mix upper, lower, and digit characters and carry at least
 * two low-frequency letters (j, k, q, v, x, z), which random tokens show
 * at roughly ten times English rates.
 */
export function looksSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.length < SECRET_MIN_LENGTH || value.length > SECRET_MAX_LENGTH) {
    return false;
  }
  if (/\s/.test(value)) return false;
  if (value.includes("/") || value.includes("\\")) return false;
  if (UUID_PATTERN.test(value)) return false;
  if (matchesSecretPattern(value)) return true;
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return false;
  }
  const rareLetters = value.match(RARE_LETTER_PATTERN);
  return (rareLetters?.length ?? 0) >= MIN_RARE_LETTERS;
}

//
//
// Secret brand
//

/**
 * Mark a value sensitive at the point of creation. The logger renders it
 * through redactAuth wherever it lands; JSON.stringify still yields the
 * true value so the real consumer is unaffected.
 */
export function secret(value: unknown): SecretValue {
  if (isSecret(value)) return value as SecretValue;
  return {
    [SECRET_BRAND]: true,
    toJSON: () => value,
    toString: () => String(value),
    valueOf: () => value,
  } as SecretValue;
}

export function isSecret(value: unknown): boolean {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    (value as Record<symbol, unknown>)[SECRET_BRAND] === true
  );
}

//
//
// Main
//

/**
 * Build a redactor from options, env (LOG_REDACT, LOG_REDACT_KEYS), then
 * defaults. The redactor walks plain objects and arrays, returning a new
 * value on change and the original reference when nothing redacts.
 */
export function createRedactor(options: RedactionOptions = {}): Redactor {
  if (options.redact === false) return (value) => value;
  const envRedact = process.env[REDACT_ENV.REDACT];
  if (
    options.redact === undefined &&
    envRedact !== undefined &&
    DISABLED_ENV_VALUES.includes(envRedact.toLowerCase())
  ) {
    return (value) => value;
  }

  const hook =
    typeof options.redact === "function" ? options.redact : undefined;
  const keys: Record<string, RedactRender> = { ...DEFAULT_REDACT_KEYS };
  const addKeys = (names: string[]) => {
    for (const name of names) {
      const normalized = normalizeKeyName(name);
      if (normalized && !(normalized in keys)) {
        keys[normalized] = RENDER.AUTH;
      }
    }
  };
  const envKeys = process.env[REDACT_ENV.KEYS];
  if (envKeys) addKeys(envKeys.split(","));
  if (options.redactKeys) addKeys(options.redactKeys);

  function walk(
    value: unknown,
    key: string | undefined,
    path: string,
    depth: number,
    state: { nodes: number },
    seen: WeakSet<object>,
  ): unknown {
    if (depth > MAX_DEPTH || state.nodes++ > MAX_NODES) return value;
    if (hook) {
      const replaced = hook(value, { key, path });
      if (replaced !== undefined) return replaced;
    }
    if (isSecret(value)) {
      return redactAuth((value as SecretValue).valueOf());
    }
    if (key !== undefined) {
      const normalized = normalizeKeyName(key);
      const render = keys[normalized];
      if (render) return applyRender(render, value);
      if (
        typeof value === "string" &&
        AMBIGUOUS_KEYS.has(normalized) &&
        looksSecret(value)
      ) {
        return redactAuth(value);
      }
    }
    if (typeof value === "string") {
      if (matchesSecretPattern(value)) return redactAuth(value);
      return value;
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
      seen.add(value);
      let changed = false;
      const result = value.map((item, index) => {
        const next = walk(
          item,
          undefined,
          `${path}[${index}]`,
          depth + 1,
          state,
          seen,
        );
        if (next !== item) changed = true;
        return next;
      });
      seen.delete(value);
      return changed ? result : value;
    }
    if (isPlainObject(value)) {
      if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
      seen.add(value);
      let changed = false;
      const result: Record<string, unknown> = {};
      for (const childKey of Object.keys(value)) {
        const child = value[childKey];
        const childPath = path ? `${path}.${childKey}` : childKey;
        const next = walk(child, childKey, childPath, depth + 1, state, seen);
        if (next !== child) changed = true;
        result[childKey] = next;
      }
      seen.delete(value);
      return changed ? result : value;
    }
    return value;
  }

  return (value, context = {}) =>
    walk(value, context.key, context.key ?? "", 0, { nodes: 0 }, new WeakSet());
}

/**
 * Standalone redaction with default rules and current env. Recurses
 * through nested objects and arrays.
 */
export function sanitizeAuth(value: unknown): unknown {
  return createRedactor()(value);
}
