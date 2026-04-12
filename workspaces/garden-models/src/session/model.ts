import { fabricIndex, type IndexDefinition, registerModel } from "@jaypie/fabric";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
const COOKIE_NAME = "garden-session";
const SESSION_MODEL = "session";
const SESSION_PREFIX = "gs_";

const SESSION_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("xid"),
];

registerModel({ model: SESSION_MODEL, indexes: SESSION_INDEXES });

export {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  SESSION_INDEXES,
  SESSION_MODEL,
  SESSION_PREFIX,
};
