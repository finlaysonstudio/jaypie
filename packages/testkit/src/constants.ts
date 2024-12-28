export const LOG = {
  LEVEL: {
    ALL: "all",
    DEBUG: "debug",
    ERROR: "error",
    FATAL: "fatal",
    INFO: "info",
    SILENT: "silent",
    TRACE: "trace",
    WARN: "warn",
  },
} as const;

export const RE_BASE64_PATTERN = /^[a-zA-Z0-9\\+\\/]+$/;
export const RE_JWT_PATTERN = /^([^.]+)\.([^.]+)\.([^.]+)$/;
export const RE_MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;
export const RE_SIGNED_COOKIE_PATTERN = /^s:([^.]+)\.([^.]+)$/;
export const RE_UUID_4_PATTERN =
  /^[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}$/i;
export const RE_UUID_5_PATTERN =
  /^[a-f0-9]{8}-?[a-f0-9]{4}-?5[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}$/i;
export const RE_UUID_PATTERN =
  /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}$/i;
