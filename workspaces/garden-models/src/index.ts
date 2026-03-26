// Models (side-effect: registers all models with @jaypie/fabric)
export {
  APIKEY_INDEXES,
  APIKEY_MODEL,
  extractToken,
  GARDEN_KEY_OPTIONS,
  validateApiKey,
} from "./apikey/index";
export type { ValidateResult } from "./apikey/index";

export {
  GARDEN_INDEXES,
  GARDEN_MODEL,
} from "./garden/index";
export type { GardenEntity } from "./garden/index";

export {
  JOURNAL_CATEGORIES,
  JOURNAL_INDEXES,
  JOURNAL_MODEL,
} from "./journal/index";
export type { JournalCategory, JournalEntity } from "./journal/index";

export {
  NOTE_INDEXES,
  NOTE_MODEL,
} from "./note/index";
export type { NoteEntity } from "./note/index";

export {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  SESSION_INDEXES,
  SESSION_MODEL,
  SESSION_PREFIX,
} from "./session/index";
export type { HistoryEvent, SessionEntity } from "./session/index";

export {
  DEFAULT_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  USER_INDEXES,
  USER_MODEL,
} from "./user/index";
export type { UpsertUserInput, UserEntity } from "./user/index";
