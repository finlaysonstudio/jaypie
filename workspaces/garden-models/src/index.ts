// Models (side-effect: registers all models with @jaypie/fabric)
export {
  APIKEY_INDEXES,
  APIKEY_MODEL,
  extractToken,
  GARDEN_KEY_OPTIONS,
  validateApiKey,
} from "./apikey/index.js";
export type { ValidateResult } from "./apikey/index.js";

export {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  SESSION_INDEXES,
  SESSION_MODEL,
  SESSION_PREFIX,
} from "./session/index.js";
export type { HistoryEvent, SessionEntity } from "./session/index.js";

export {
  DEFAULT_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  USER_INDEXES,
  USER_MODEL,
} from "./user/index.js";
export type { UpsertUserInput, UserEntity } from "./user/index.js";
