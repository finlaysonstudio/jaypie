import { hostname } from "node:os";
import { request } from "node:https";

import { DATADOG_TRANSPORT, LEVEL } from "./constants";

// Level-to-Datadog status mapping
const LEVEL_TO_STATUS: Record<string, string> = {
  [LEVEL.TRACE]: "debug",
  [LEVEL.DEBUG]: "debug",
  [LEVEL.INFO]: "info",
  [LEVEL.WARN]: "warn",
  [LEVEL.ERROR]: "error",
  [LEVEL.FATAL]: "critical",
};

function envBoolean(
  key: string,
  { defaultValue }: { defaultValue: boolean },
): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  return !(
    lower === "" ||
    lower === "0" ||
    lower === "f" ||
    lower === "false" ||
    lower === "n" ||
    lower === "no"
  );
}

export function isDatadogForwardingEnabled(): boolean {
  return (
    envBoolean(DATADOG_TRANSPORT.ENV.FORWARDING, { defaultValue: false }) &&
    !!process.env[DATADOG_TRANSPORT.ENV.API_KEY]
  );
}

interface DatadogLogEntry {
  ddsource: string;
  ddtags: string;
  hostname: string;
  message: string;
  service: string;
  status: string;
}

class DatadogLogTransport {
  private _beforeExitHandler: (() => void) | null = null;
  private _buffer: DatadogLogEntry[] = [];
  private _flushTimer: ReturnType<typeof setInterval> | null = null;
  private _ddsource = "nodejs";
  private _env: string;
  private _hostname: string;
  private _service: string;
  private _site: string;

  constructor() {
    const env = process.env;
    this._env =
      env[DATADOG_TRANSPORT.ENV.DD_ENV] ||
      env[DATADOG_TRANSPORT.ENV.PROJECT_ENV] ||
      "local";
    this._hostname =
      env[DATADOG_TRANSPORT.ENV.DD_HOST] ||
      env[DATADOG_TRANSPORT.ENV.PROJECT_HOST] ||
      hostname();
    this._service =
      env[DATADOG_TRANSPORT.ENV.DD_SERVICE] ||
      env[DATADOG_TRANSPORT.ENV.PROJECT_SERVICE] ||
      "unknown";
    this._site = env[DATADOG_TRANSPORT.ENV.DD_SITE] || "datadoghq.com";

    this._flushTimer = setInterval(() => {
      this.flush();
    }, DATADOG_TRANSPORT.FLUSH_INTERVAL_MS);
    // Unref so timer doesn't keep process alive
    if (this._flushTimer && typeof this._flushTimer.unref === "function") {
      this._flushTimer.unref();
    }

    // Best-effort flush on exit
    this._beforeExitHandler = () => this.flush();
    process.on("beforeExit", this._beforeExitHandler);
  }

  send(line: string, level: string): void {
    const entry: DatadogLogEntry = {
      ddsource: this._ddsource,
      ddtags: `env:${this._env}`,
      hostname: this._hostname,
      message: line,
      service: this._service,
      status: LEVEL_TO_STATUS[level] || "info",
    };
    this._buffer.push(entry);
    if (this._buffer.length >= DATADOG_TRANSPORT.MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  flush(): void {
    if (this._buffer.length === 0) return;

    // Atomic swap
    const batch = this._buffer;
    this._buffer = [];

    const apiKey = process.env[DATADOG_TRANSPORT.ENV.API_KEY];
    if (!apiKey) return;

    const body = JSON.stringify(batch);
    const options = {
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
      },
      hostname: `http-intake.logs.${this._site}`,
      method: "POST",
      path: DATADOG_TRANSPORT.INTAKE_PATH,
    };

    try {
      const req = request(options, () => {
        // Response intentionally ignored
      });
      req.on("error", () => {
        // Silently swallow transport errors
      });
      req.write(body);
      req.end();
    } catch {
      // Transport must never throw
    }
  }

  destroy(): void {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._beforeExitHandler) {
      process.removeListener("beforeExit", this._beforeExitHandler);
      this._beforeExitHandler = null;
    }
    try {
      this.flush();
    } catch {
      // Best-effort
    }
  }
}

let _instance: DatadogLogTransport | null = null;

export function getDatadogTransport(): DatadogLogTransport | null {
  if (!isDatadogForwardingEnabled()) return null;
  if (!_instance) {
    _instance = new DatadogLogTransport();
  }
  return _instance;
}

export function _resetDatadogTransport(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
